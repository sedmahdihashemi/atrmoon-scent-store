import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Sparkles } from "lucide-react";
import { formatToman } from "@/lib/cart-session";
import { Link } from "@tanstack/react-router";
import { WishlistButton } from "@/components/WishlistButton";

export const Route = createFileRoute("/products")({ component: ProductsLayout });

function ProductsLayout() {
  const matches = useMatches();
  if (matches.some((m) => m.routeId === "/products/$slug")) return <Outlet />;
  return <ProductsListing />;
}

function ProductsListing() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("products").select("id, slug, name, main_image_url, gender, store_id, stores(store_name), product_variants(price, status)").eq("status", "active").limit(60).then(({ data }) => setItems(data ?? []));
  }, []);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-4xl text-ink">رایحه‌ها</h1>
          <p className="text-muted-foreground font-serif italic mt-2">از میان عطاریهای فروشندگان عطرمون.</p>
        </header>
        {items === null ? <LoadingState /> :
         items.length === 0 ? <EmptyState title="هنوز رایحه‌ای ثبت نشده" message="به‌زودی نخستین رایحه‌ها در عطرمون عرضه می‌شوند." icon={<Sparkles className="w-8 h-8" />} /> :
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
           {items.map((p: any) => {
             const minPrice = Math.min(...(p.product_variants ?? []).filter((v: any) => v.status === "active").map((v: any) => Number(v.price)).filter(Boolean));
             return (
               <Link key={p.id} to="/products/$slug" params={{ slug: p.slug }} className="paper-card rounded-md p-4 hover:border-[var(--gold)] transition relative">
                 <WishlistButton productId={p.id} />
                 <div className="aspect-square bg-[var(--moon)]/40 rounded-sm mb-3 flex items-center justify-center text-[var(--gold)]/60">
                   {p.main_image_url ? <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover rounded-sm" /> : <Sparkles className="w-10 h-10" />}
                 </div>
                 <h3 className="font-serif text-ink truncate">{p.name}</h3>
                 <p className="text-xs text-muted-foreground mt-1 truncate">{p.stores?.store_name}</p>
                 {Number.isFinite(minPrice) && <p className="text-sm text-[var(--gold)] mt-2 font-serif">{formatToman(minPrice)}</p>}
               </Link>
             );
           })}
         </div>}
      </div>
    </PublicLayout>
  );
}