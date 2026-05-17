import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState, LoadingState } from "@/components/ui/loading-state";
import { ShoppingBag, Trash2, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { formatToman } from "@/lib/cart-session";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const { items, loading, subtotal, updateQty, removeItem } = useCart();
  const navigate = useNavigate();

  if (loading) return <PublicLayout><LoadingState label="گشودن بقچه رایحه…" /></PublicLayout>;

  if (items.length === 0) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16">
          <EmptyState title="بقچه رایحه‌های شما هنوز خالی‌ست" message="به عطاری رایحه‌ها برگردید و چیزی برای امشب برگزینید." icon={<ShoppingBag className="w-8 h-8" />} />
          <div className="mt-6 text-center"><Link to="/products"><Button>کشف رایحه‌ها</Button></Link></div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-8">بقچه رایحه‌های شما</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {items.map((it) => {
              const price = Number(it.variant?.discount_price ?? it.variant?.price ?? 0);
              return (
                <div key={it.id} className="paper-card rounded-md p-4 flex gap-4 items-center">
                  <div className="w-20 h-20 bg-[var(--moon)]/40 rounded-sm shrink-0 flex items-center justify-center text-[var(--gold)]/60 overflow-hidden">
                    {it.product.main_image_url
                      ? <img src={it.product.main_image_url} alt={it.product.name} className="w-full h-full object-cover" />
                      : <Sparkles className="w-7 h-7" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to="/products/$slug" params={{ slug: it.product.slug }} className="font-serif text-ink hover:text-[var(--gold)] truncate block">{it.product.name}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {it.variant?.volume_ml.toLocaleString("fa-IR")} میلی‌لیتر · {it.variant?.bottle_types?.name}
                    </p>
                    <p className="font-serif text-[var(--gold)] mt-1 text-sm">{formatToman(price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(it.id, it.quantity - 1)} className="w-8 h-8 rounded-sm border border-ink/15 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="font-serif w-6 text-center text-sm">{it.quantity.toLocaleString("fa-IR")}</span>
                    <button onClick={() => updateQty(it.id, it.quantity + 1)} className="w-8 h-8 rounded-sm border border-ink/15 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => removeItem(it.id)} aria-label="حذف" className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <aside className="paper-card rounded-md p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-serif text-lg text-ink mb-4">جمع‌بندی</h3>
            <div className="flex justify-between text-sm text-ink/80 mb-2">
              <span>جمع کالاها</span><span>{formatToman(subtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed font-serif italic">
              هزینه ارسال پس از تماس فروشنده تعیین می‌شود.
            </p>
            <div className="ink-divider my-5" />
            <div className="flex justify-between font-serif text-base text-ink mb-5">
              <span>قابل پرداخت</span>
              <span className="text-[var(--gold)]">{formatToman(subtotal)}</span>
            </div>
            <Button className="w-full h-11 font-serif" onClick={() => navigate({ to: "/checkout" })}>ادامه به تسویه</Button>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}