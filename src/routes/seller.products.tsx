import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { toast } from "sonner";

export const Route = createFileRoute("/seller/products")({ component: ProductsPage });

function ProductsPage() {
  const matches = useMatches();
  // child route handles its own UI
  if (matches.some((m) => m.routeId === "/seller/products/new" || m.routeId === "/seller/products/$id")) return <Outlet />;
  return <ProductsList />;
}

function ProductsList() {
  const { storeId } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);

  const load = async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("products")
      .select("id, name, slug, status, main_image_url, product_variants(price, status), product_inventory(available_stock_ml)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, [storeId]);

  const remove = async (id: string) => {
    if (!confirm("این رایحه حذف شود؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("حذف شد"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">رایحه‌های دفتر شما</h2>
        <Link to="/seller/products/new"><Button size="sm"><Plus className="w-4 h-4 ml-1" /> رایحه‌ی تازه</Button></Link>
      </div>
      {items === null ? <LoadingState /> :
        items.length === 0 ? <EmptyState title="هنوز رایحه‌ای ثبت نشده" message="نخستین رایحه‌ی دفتر خود را بیفزایید." icon={<Sparkles className="w-7 h-7" />} /> :
        <div className="paper-card rounded-md divide-y divide-ink/5 overflow-hidden">
          {items.map((p: any) => {
            const prices = (p.product_variants ?? []).filter((v: any) => v.status === "active").map((v: any) => Number(v.price)).filter(Boolean);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            const stock = p.product_inventory?.[0]?.available_stock_ml ?? 0;
            return (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <div className="w-12 h-12 bg-[var(--moon)]/40 rounded-sm shrink-0 flex items-center justify-center text-[var(--gold)]/60 overflow-hidden">
                  {p.main_image_url ? <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-ink truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "active" ? "فعال" : p.status === "draft" ? "پیش‌نویس" : p.status === "out_of_stock" ? "ناموجود" : "غیرفعال"}
                    {" · "}موجودی {Number(stock).toLocaleString("fa-IR")} میلی‌لیتر
                    {minPrice ? " · از " + minPrice.toLocaleString("fa-IR") + " تومان" : ""}
                  </p>
                </div>
                <Link to="/seller/products/$id" params={{ id: p.id }} className="p-2 text-ink/70 hover:text-[var(--gold)]" aria-label="ویرایش"><Pencil className="w-4 h-4" /></Link>
                <button onClick={() => remove(p.id)} className="p-2 text-ink/70 hover:text-destructive" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}