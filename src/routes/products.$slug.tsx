import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/cart-session";
import { useCart } from "@/hooks/useCart";
import { Sparkles, ShoppingBag, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/products/$slug")({ component: ProductDetail });

function ProductDetail() {
  const { slug } = Route.useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select(`id, name, slug, description, gender, concentration, main_image_url, store_id,
          stores(id, store_name, slug, city),
          brands(name),
          product_images(image_url, sort_order),
          product_variants(id, volume_ml, price, discount_price, status, bottle_types(name)),
          product_scent_notes(scent_notes(name, type))`)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (data) {
        setProduct(data);
        const vs = (data.product_variants ?? []).filter((v: any) => v.status === "active").sort((a: any, b: any) => a.volume_ml - b.volume_ml);
        setVariants(vs);
        if (vs[0]) setSelectedVariantId(vs[0].id);
        setNotes((data.product_scent_notes ?? []).map((p: any) => p.scent_notes).filter(Boolean));
        const { data: inv } = await supabase.from("product_inventory").select("available_stock_ml").eq("product_id", data.id).maybeSingle();
        setInventory(inv);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <PublicLayout><LoadingState label="گشودن دفتر این رایحه…" /></PublicLayout>;
  if (!product) return <PublicLayout><div className="container mx-auto px-4 py-16"><EmptyState title="این رایحه یافت نشد" /></div></PublicLayout>;

  const sel = variants.find((v) => v.id === selectedVariantId);
  const price = sel ? Number(sel.discount_price ?? sel.price) : 0;
  const available = inventory?.available_stock_ml ?? 0;
  const maxQty = sel ? Math.max(0, Math.floor(available / sel.volume_ml)) : 0;
  const inStock = maxQty > 0;
  const topNotes = notes.filter((n) => n.type === "top");
  const middleNotes = notes.filter((n) => n.type === "middle" || n.type === "heart");
  const baseNotes = notes.filter((n) => n.type === "base");
  const otherNotes = notes.filter((n) => !["top","middle","heart","base"].includes(n.type));

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 md:gap-14">
          <div className="paper-card rounded-md p-6 md:p-8">
            <div className="aspect-square bg-[var(--moon)]/40 rounded-sm flex items-center justify-center text-[var(--gold)]/60 overflow-hidden">
              {product.main_image_url ? (
                <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (<Sparkles className="w-16 h-16" />)}
            </div>
          </div>
          <div>
            <p className="text-xs font-serif text-[var(--gold)] tracking-widest uppercase mb-2">{product.brands?.name ?? "—"}</p>
            <h1 className="font-serif text-4xl text-ink leading-tight mb-3">{product.name}</h1>
            <Link to="/stores" className="text-sm text-muted-foreground hover:text-[var(--gold)]">
              از دفتر <span className="font-serif text-ink">{product.stores?.store_name}</span>
            </Link>
            {product.description && (
              <p className="mt-6 text-ink/80 leading-loose font-serif text-[15px] whitespace-pre-line">{product.description}</p>
            )}

            {(topNotes.length + middleNotes.length + baseNotes.length + otherNotes.length) > 0 && (
              <div className="mt-8 space-y-3">
                <NoteRow label="نُت‌های آغازین" items={topNotes} />
                <NoteRow label="نُت‌های میانی" items={middleNotes} />
                <NoteRow label="نُت‌های پایه" items={baseNotes} />
                <NoteRow label="نُت‌ها" items={otherNotes} />
              </div>
            )}

            <div className="ink-divider my-8" />

            <div>
              <p className="text-sm font-serif text-ink mb-3">انتخاب حجم و بطری</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = v.id === selectedVariantId;
                  return (
                    <button key={v.id} onClick={() => { setSelectedVariantId(v.id); setQty(1); }}
                      className={`px-4 py-2 rounded-sm border text-sm font-serif transition ${active ? "bg-ink text-[var(--paper)] border-ink" : "border-ink/15 text-ink hover:border-[var(--gold)]"}`}>
                      {v.volume_ml.toLocaleString("fa-IR")} میلی‌لیتر · {v.bottle_types?.name}
                    </button>
                  );
                })}
                {variants.length === 0 && <p className="text-sm text-muted-foreground">حجمی برای این رایحه ثبت نشده.</p>}
              </div>
            </div>

            {sel && (
              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  {sel.discount_price && Number(sel.discount_price) < Number(sel.price) && (
                    <p className="text-xs text-muted-foreground line-through">{formatToman(sel.price)}</p>
                  )}
                  <p className="font-serif text-2xl text-[var(--gold)]">{formatToman(price)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inStock ? `موجودی: ${available.toLocaleString("fa-IR")} میلی‌لیتر` : "ناموجود"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-sm border border-ink/15 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                  <span className="font-serif w-8 text-center">{qty.toLocaleString("fa-IR")}</span>
                  <button onClick={() => setQty(Math.min(maxQty || 1, qty + 1))} className="w-9 h-9 rounded-sm border border-ink/15 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <Button
              className="mt-6 w-full h-12 font-serif text-base"
              disabled={!sel || !inStock}
              onClick={() => sel && addItem(product.id, sel.id, product.store_id, qty)}>
              <ShoppingBag className="w-5 h-5 ml-2" />
              {inStock ? "افزودن به سبد" : "ناموجود"}
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function NoteRow({ label, items }: { label: string; items: any[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs font-serif text-[var(--gold)] tracking-wider">{label}:</span>
      {items.map((n, i) => (
        <span key={i} className="text-sm text-ink/80 font-serif">{n.name}{i < items.length - 1 ? "،" : ""}</span>
      ))}
    </div>
  );
}