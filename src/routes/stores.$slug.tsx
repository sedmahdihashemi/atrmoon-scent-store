import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Store, Sparkles, MapPin } from "lucide-react";
import { formatToman } from "@/lib/cart-session";
import { WishlistButton } from "@/components/WishlistButton";

export const Route = createFileRoute("/stores/$slug")({ component: StoreDetail });

function StoreDetail() {
  const { slug } = Route.useParams();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("stores")
        .select("id, store_name, slug, city, description, logo_url, address")
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();
      setStore(s);
      if (s) {
        const { data: ps } = await supabase
          .from("products")
          .select("id, slug, name, main_image_url, gender, brands(name), product_variants(price, status)")
          .eq("store_id", s.id)
          .eq("status", "active");
        setProducts(ps ?? []);
      } else setProducts([]);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <PublicLayout><LoadingState label="گشودن این عطاری…" /></PublicLayout>;
  if (!store) return <PublicLayout><div className="container mx-auto px-4 py-16"><EmptyState title="این عطرفروشی یافت نشد" icon={<Store className="w-8 h-8" />} /></div></PublicLayout>;

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="paper-card rounded-md p-6 md:p-8 mb-8 flex items-start gap-5">
          <div className="w-16 h-16 rounded-sm bg-[var(--moon)]/40 flex items-center justify-center shrink-0 overflow-hidden">
            {store.logo_url ? <img src={store.logo_url} alt={store.store_name} className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-[var(--gold)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-3xl text-ink">{store.store_name}</h1>
            {store.city && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {store.city}
              </p>
            )}
            {store.description && <p className="text-sm text-ink/70 mt-3 leading-7">{store.description}</p>}
          </div>
        </div>

        <h2 className="font-serif text-xl text-ink mb-4">رایحه‌های این عطاری</h2>
        {products === null ? <LoadingState /> :
         products.length === 0 ? <EmptyState title="هنوز رایحه‌ای ثبت نشده" icon={<Sparkles className="w-8 h-8" />} /> :
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
           {products.map((p: any) => {
             const minPrice = Math.min(...(p.product_variants ?? []).filter((v: any) => v.status === "active").map((v: any) => Number(v.price)).filter(Boolean));
             return (
               <Link key={p.id} to="/products/$slug" params={{ slug: p.slug }} className="paper-card rounded-md p-4 hover:border-[var(--gold)] transition relative">
                 <WishlistButton productId={p.id} />
                 <div className="aspect-square bg-[var(--moon)]/40 rounded-sm mb-3 flex items-center justify-center text-[var(--gold)]/60">
                   {p.main_image_url ? <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover rounded-sm" /> : <Sparkles className="w-10 h-10" />}
                 </div>
                 <h3 className="font-serif text-ink truncate">{p.name}</h3>
                 <p className="text-xs text-muted-foreground mt-1 truncate">{p.brands?.name ?? "—"}</p>
                 {Number.isFinite(minPrice) && <p className="text-sm text-[var(--gold)] mt-2 font-serif">{formatToman(minPrice)}</p>}
               </Link>
             );
           })}
         </div>}
      </div>
    </PublicLayout>
  );
}