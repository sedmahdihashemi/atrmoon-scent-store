import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// When a guest builds a cart then logs in, RLS makes that session-based cart
// invisible to the now-authenticated user (customer_id is null and the
// x-cart-session header is gone), so the client would otherwise create a
// fresh empty cart and the guest's items would be lost. This merges the
// guest cart into the user's cart server-side (service role, bypasses RLS).
//
// The guest sessionId / cartId are unguessable UUIDs held only in that
// browser, so they act as their own bearer credential — same pattern used
// elsewhere in this project. We only ever touch carts whose customer_id is
// still null, so a user can never pull in another account's real cart.
export const mergeGuestCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().uuid().nullable().optional(),
        guestCartId: z.string().uuid().nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const orParts: string[] = [];
    if (data.sessionId) orParts.push(`session_id.eq.${data.sessionId}`);
    if (data.guestCartId) orParts.push(`id.eq.${data.guestCartId}`);
    if (orParts.length === 0) return { ok: true as const, cartId: null };

    const { data: guestCarts, error: gcErr } = await supabaseAdmin
      .from("carts")
      .select("id, store_id")
      .is("customer_id", null)
      .or(orParts.join(","));
    if (gcErr) {
      console.error("[mergeGuestCart] load guest carts", gcErr);
      return { ok: false as const, cartId: null };
    }
    if (!guestCarts || guestCarts.length === 0) return { ok: true as const, cartId: null };

    const guestCartIds = guestCarts.map((c: any) => c.id);
    const { data: guestItemsRaw, error: giErr } = await supabaseAdmin
      .from("cart_items")
      .select("id, cart_id, product_id, product_variant_id, quantity")
      .in("cart_id", guestCartIds);
    if (giErr) console.error("[mergeGuestCart] load guest items", giErr);
    const guestItems = guestItemsRaw ?? [];
    const guestStore = (guestCarts.find((c: any) => c.store_id) as any)?.store_id ?? null;

    const { data: userCart, error: ucErr } = await supabaseAdmin
      .from("carts")
      .select("id, store_id")
      .eq("customer_id", userId)
      .limit(1)
      .maybeSingle();
    if (ucErr) console.error("[mergeGuestCart] load user cart", ucErr);

    // Nothing worth keeping — clean up the empty guest carts and bail.
    if (guestItems.length === 0) {
      await supabaseAdmin.from("carts").delete().in("id", guestCartIds);
      return { ok: true as const, cartId: (userCart as any)?.id ?? null };
    }

    // No prior user cart: claim the guest cart outright (cheapest path).
    if (!userCart) {
      const primary = guestCartIds[0];
      await supabaseAdmin
        .from("carts")
        .update({ customer_id: userId, session_id: null, store_id: guestStore })
        .eq("id", primary);
      const others = guestCartIds.filter((id: string) => id !== primary);
      if (others.length) {
        await supabaseAdmin.from("cart_items").update({ cart_id: primary }).in("cart_id", others);
        await supabaseAdmin.from("carts").delete().in("id", others);
      }
      return { ok: true as const, cartId: primary };
    }

    // Existing user cart: merge the guest items in.
    const targetCartId = (userCart as any).id as string;
    const { data: userItemsRaw } = await supabaseAdmin
      .from("cart_items")
      .select("id, product_variant_id, quantity")
      .eq("cart_id", targetCartId);
    let userItems = userItemsRaw ?? [];

    // Single-store rule: if the user's old cart is from a different store,
    // the just-built guest cart (recent intent) wins — clear the old items.
    if (userItems.length > 0 && (userCart as any).store_id && guestStore && (userCart as any).store_id !== guestStore) {
      await supabaseAdmin.from("cart_items").delete().eq("cart_id", targetCartId);
      userItems = [];
    }

    const newStore = guestStore ?? (userCart as any).store_id;
    if (newStore !== (userCart as any).store_id) {
      await supabaseAdmin.from("carts").update({ store_id: newStore }).eq("id", targetCartId);
    }

    const byVariant = new Map<string, { id: string; quantity: number }>();
    for (const ui of userItems as any[]) byVariant.set(ui.product_variant_id, { id: ui.id, quantity: ui.quantity });
    for (const gi of guestItems as any[]) {
      const existing = byVariant.get(gi.product_variant_id);
      if (existing) {
        await supabaseAdmin.from("cart_items").update({ quantity: existing.quantity + gi.quantity }).eq("id", existing.id);
      } else {
        const ins = await supabaseAdmin
          .from("cart_items")
          .insert({ cart_id: targetCartId, product_id: gi.product_id, product_variant_id: gi.product_variant_id, quantity: gi.quantity })
          .select("id")
          .single();
        if (ins.data) byVariant.set(gi.product_variant_id, { id: (ins.data as any).id, quantity: gi.quantity });
      }
    }

    await supabaseAdmin.from("cart_items").delete().in("cart_id", guestCartIds);
    await supabaseAdmin.from("carts").delete().in("id", guestCartIds);
    return { ok: true as const, cartId: targetCartId };
  });
