import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingBag, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatToman } from "@/lib/cart-session";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { WishlistButton } from "@/components/WishlistButton";

type Row = {
  id: string; slug: string; name: string; main_image_url: string | null;
  store_id: string; store_name: string | null; brand_name: string | null;
  min_price: number; cheapest_variant_id: string; sold_qty: number;
};

export function BestSellers() {
  const [items, setItems] = useState<Row[] | null>(null);
  const { addItem } = useCart();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).rpc("top_selling_products", { p_limit: 8 }).then(({ data }: any) => {
      setItems((data as Row[]) ?? []);
    });
  }, []);

  if (items !== null && items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-gold-deep" />
            انتخاب پرسه‌گردان
          </div>
          <h2 className="heading-display text-3xl md:text-4xl text-ink mt-2">پرفروش‌ترین‌ها</h2>
          <p className="text-ink-soft text-sm mt-2 font-serif italic">
            رایحه‌هایی که بیشترین خاطره را در عطرمون ساخته‌اند.
          </p>
        </div>
        <Link to="/products" className="hidden md:inline-block text-sm text-ink-soft hover:text-gold-deep transition-colors border-b border-ink/20 pb-0.5">
          همه‌ی رایحه‌ها ←
        </Link>
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="paper-card rounded-md p-4 animate-pulse">
              <div className="aspect-square bg-ink/5 rounded-sm mb-3" />
              <div className="h-4 bg-ink/5 rounded w-3/4 mb-2" />
              <div className="h-3 bg-ink/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map((p, i) => (
            <div key={p.id} className="paper-card paper-card-hover rounded-md p-4 relative group flex flex-col">
              {i < 3 && (
                <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 bg-gold-deep text-paper text-[10px] font-serif px-2 py-0.5 rounded-full">
                  #{i + 1} پرفروش
                </span>
              )}
              <WishlistButton productId={p.id} />
              <Link to="/products/$slug" params={{ slug: p.slug }} className="block">
                <div className="aspect-square bg-[var(--moon)]/40 rounded-sm mb-3 flex items-center justify-center text-[var(--gold)]/60 overflow-hidden">
                  {p.main_image_url
                    ? <img src={p.main_image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <Sparkles className="w-10 h-10" />}
                </div>
                <h3 className="font-serif text-ink truncate">{p.name}</h3>
                <p className="text-xs text-ink-soft/80 mt-1 truncate">{p.brand_name ?? p.store_name}</p>
              </Link>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink/10">
                <span className="text-sm text-gold-deep font-serif">{formatToman(p.min_price)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    try { await addItem(p.id, p.cheapest_variant_id, p.store_id, 1); }
                    finally { setBusy(null); }
                  }}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  افزودن
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}