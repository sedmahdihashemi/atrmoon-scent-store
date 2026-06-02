import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Lightweight in-memory wishlist hook. Loads the signed-in user's wishlist
 * once per session, exposes `has(productId)` + `toggle(productId)`.
 */
export function useWishlist() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wishlists")
      .select("product_id")
      .eq("customer_id", user.id);
    setIds(new Set((data ?? []).map((r: any) => r.product_id as string)));
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) { toast.error("برای ذخیره علاقه‌مندی، ابتدا وارد شوید"); return false; }
    const already = ids.has(productId);
    // optimistic update
    setIds((s) => {
      const next = new Set(s);
      if (already) next.delete(productId); else next.add(productId);
      return next;
    });
    if (already) {
      const { error } = await supabase.from("wishlists").delete()
        .eq("customer_id", user.id).eq("product_id", productId);
      if (error) { toast.error(error.message); void refresh(); return true; }
      toast.success("از علاقه‌مندی‌ها حذف شد");
      return false;
    } else {
      const { error } = await supabase.from("wishlists").insert({ customer_id: user.id, product_id: productId });
      if (error) { toast.error(error.message); void refresh(); return false; }
      toast.success("به علاقه‌مندی‌ها افزوده شد");
      return true;
    }
  }, [user, ids, refresh]);

  return { ids, has: (id: string) => ids.has(id), toggle, loading, signedIn: !!user };
}