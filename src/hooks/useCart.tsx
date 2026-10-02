import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateCartSession, getCartSessionId, getStoredCartId, setStoredCartId, clearCartSession, clearGuestSessionKey } from "@/lib/cart-session";
import { mergeGuestCart } from "@/lib/cart-merge.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CartItem = {
  id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    main_image_url: string | null;
    store_id: string;
    brands?: { name: string } | null;
  };
  variant: {
    id: string;
    volume_ml: number;
    price: number;
    discount_price: number | null;
    bottle_types: { name: string };
  };
};

type Ctx = {
  cartId: string | null;
  storeId: string | null;
  items: CartItem[];
  loading: boolean;
  count: number;
  subtotal: number;
  addItem: (productId: string, variantId: string, storeId: string, qty?: number) => Promise<void>;
  updateQty: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
  resetAfterCheckout: () => void;
};

const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const mergeCart = useServerFn(mergeGuestCart);
  const [cartId, setCartId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureCart = useCallback(async (): Promise<{ id: string; session: string | null } | null> => {
    if (typeof window === "undefined") return null;
    const session = user ? null : getOrCreateCartSession();
    // RLS for guest carts requires this header to match the cart's session_id.
    // Authenticated users are matched by customer_id and don't need it.
    // NOTE: supabase-js stores rest.headers as a Headers object, so plain
    // `headers["x"] = v` / `delete headers["x"]` are silently ignored (that
    // bug meant guest carts never actually sent the header → RLS rejected
    // every guest insert). Use .set()/.delete(), with a plain-object fallback.
    const headers = (supabase as any).rest?.headers;
    if (headers) {
      if (session) {
        if (typeof headers.set === "function") headers.set("x-cart-session", session);
        else headers["x-cart-session"] = session;
      } else {
        if (typeof headers.delete === "function") headers.delete("x-cart-session");
        else delete headers["x-cart-session"];
      }
    }
    // try existing
    let q = supabase.from("carts").select("id, store_id").limit(1);
    if (user) q = q.eq("customer_id", user.id);
    else q = q.eq("session_id", session!);
    const { data } = await q.maybeSingle();
    if (data) {
      setCartId(data.id);
      setStoreId(data.store_id);
      setStoredCartId(data.id);
      return { id: data.id, session };
    }
    const stored = getStoredCartId();
    if (stored) {
      const { data: c } = await supabase.from("carts").select("id, store_id").eq("id", stored).maybeSingle();
      if (c) { setCartId(c.id); setStoreId(c.store_id); return { id: c.id, session }; }
    }
    const ins = await supabase.from("carts").insert({
      customer_id: user?.id ?? null,
      session_id: user ? null : session,
    }).select("id, store_id").single();
    if (ins.error || !ins.data) return null;
    setCartId(ins.data.id);
    setStoreId(ins.data.store_id);
    setStoredCartId(ins.data.id);
    return { id: ins.data.id, session };
  }, [user]);

  const loadItems = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("cart_items")
      .select(`id, product_id, product_variant_id, quantity,
        product:products(id, name, slug, main_image_url, store_id, brands(name)),
        variant:product_variants(id, volume_ml, price, discount_price, bottle_types(name))`)
      .eq("cart_id", id);
    setItems((data as any) ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const c = await ensureCart();
    if (c) await loadItems(c.id);
    setLoading(false);
  }, [ensureCart, loadItems]);

  // Pull a guest cart (built before login) into the just-authenticated
  // user's account, then load the merged cart. Done server-side because RLS
  // hides the session-based guest cart from the logged-in user.
  const mergeThenLoad = useCallback(async () => {
    setLoading(true);
    // Only a real guest session has this key; a reload of an already
    // logged-in user cleared it on the prior login, so we skip the server
    // round-trip in that case and just load the user's cart.
    const sessionId = getCartSessionId();
    if (sessionId) {
      try {
        const res = await mergeCart({ data: { sessionId, guestCartId: getStoredCartId() } });
        if (res?.cartId) setStoredCartId(res.cartId);
      } catch (e) {
        console.error("[cart] merge on login failed", e);
      }
      clearGuestSessionKey();
    }
    const c = await ensureCart();
    if (c) await loadItems(c.id);
    setLoading(false);
  }, [ensureCart, loadItems, mergeCart]);

  // Run merge once on the guest→user transition; otherwise just (re)load.
  const prevUserRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevUserRef.current;
    const curr = user?.id ?? null;
    prevUserRef.current = curr;
    if (prev === undefined) { void refresh(); return; }      // first run
    if (!prev && curr) { void mergeThenLoad(); return; }      // just logged in
    void refresh();                                            // logout / user switch
  }, [user, refresh, mergeThenLoad]);

  const addItem = useCallback(async (productId: string, variantId: string, itemStoreId: string, qty = 1) => {
    const c = await ensureCart();
    if (!c) { toast.error("سبد در دسترس نیست"); return; }
    // single-store rule: if cart has a different store, ask to clear
    if (storeId && storeId !== itemStoreId) {
      const ok = window.confirm("سبد شما از یک عطرفروشی دیگر است. خالی شود؟");
      if (!ok) return;
      await supabase.from("cart_items").delete().eq("cart_id", c.id);
    }
    await supabase.from("carts").update({ store_id: itemStoreId }).eq("id", c.id);
    // upsert quantity
    const { data: existing } = await supabase.from("cart_items")
      .select("id, quantity").eq("cart_id", c.id).eq("product_variant_id", variantId).maybeSingle();
    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({
        cart_id: c.id, product_id: productId, product_variant_id: variantId, quantity: qty,
      });
    }
    setStoreId(itemStoreId);
    await loadItems(c.id);
    toast.success("به سبد افزوده شد");
  }, [ensureCart, loadItems, storeId]);

  const updateQty = useCallback(async (itemId: string, qty: number) => {
    if (qty < 1) return;
    await supabase.from("cart_items").update({ quantity: qty }).eq("id", itemId);
    if (cartId) await loadItems(cartId);
  }, [cartId, loadItems]);

  const removeItem = useCallback(async (itemId: string) => {
    await supabase.from("cart_items").delete().eq("id", itemId);
    if (cartId) await loadItems(cartId);
  }, [cartId, loadItems]);

  const resetAfterCheckout = useCallback(() => {
    setItems([]);
    setStoreId(null);
    clearCartSession();
    setCartId(null);
    setTimeout(() => { void refresh(); }, 0);
  }, [refresh]);

  const subtotal = items.reduce((s, it) => s + Number(it.variant?.discount_price ?? it.variant?.price ?? 0) * it.quantity, 0);
  const count = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <CartCtx.Provider value={{ cartId, storeId, items, loading, count, subtotal, addItem, updateQty, removeItem, refresh, resetAfterCheckout }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}