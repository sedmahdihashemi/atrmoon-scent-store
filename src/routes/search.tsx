import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState, LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatToman } from "@/lib/cart-session";
import { WishlistButton } from "@/components/WishlistButton";
import { Search as SearchIcon, Sparkles, X, SlidersHorizontal } from "lucide-react";

const sortValues = ["newest", "price_asc", "price_desc", "name"] as const;
const genderValues = ["any", "male", "female", "unisex"] as const;
const concentrationValues = ["any", "edt", "edp", "parfum", "extrait", "cologne"] as const;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  brands: fallback(z.string().array(), []).default([]),
  notes: fallback(z.string().array(), []).default([]),
  stores: fallback(z.string().array(), []).default([]),
  gender: fallback(z.enum(genderValues), "any").default("any"),
  concentration: fallback(z.enum(concentrationValues), "any").default("any"),
  min_price: fallback(z.number().nonnegative(), 0).default(0),
  max_price: fallback(z.number().nonnegative(), 0).default(0),
  in_stock: fallback(z.boolean(), false).default(false),
  on_sale: fallback(z.boolean(), false).default(false),
  sort: fallback(z.enum(sortValues), "newest").default("newest"),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
});

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [notes, setNotes] = useState<{ id: string; name: string; type: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; store_name: string }[]>([]);
  const [items, setItems] = useState<any[] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // load filter sources once
  useEffect(() => {
    (async () => {
      const [b, n, s] = await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("scent_notes").select("id, name, type").order("name"),
        supabase.from("stores").select("id, store_name").eq("status", "approved").order("store_name"),
      ]);
      setBrands((b.data ?? []) as any);
      setNotes((n.data ?? []) as any);
      setStores((s.data ?? []) as any);
    })();
  }, []);

  // run query whenever params change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setItems(null);
      let qb = supabase
        .from("products")
        .select(`id, slug, name, description, gender, concentration, main_image_url,
                  brand_id, store_id,
                  brands(name),
                  stores(store_name),
                  product_variants(price, discount_price, status),
                  product_scent_notes(scent_note_id),
                  product_inventory(available_stock_ml)`)
        .eq("status", "active")
        .limit(120);

      if (params.q.trim()) {
        const safe = params.q.trim().replace(/[%,]/g, " ");
        qb = qb.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      if (params.gender !== "any") qb = qb.eq("gender", params.gender);
      if (params.concentration !== "any") qb = qb.eq("concentration", params.concentration);
      if (params.brands.length) qb = qb.in("brand_id", params.brands);
      if (params.stores.length) qb = qb.in("store_id", params.stores);

      const { data } = await qb;
      if (cancelled) return;
      let rows = (data ?? []) as any[];

      // client-side filter for notes (junction) + price + stock + on-sale
      if (params.notes.length) {
        rows = rows.filter((p) => {
          const ids = new Set<string>((p.product_scent_notes ?? []).map((x: any) => x.scent_note_id as string));
          return params.notes.every((n: string) => ids.has(n));
        });
      }
      rows = rows.map((p) => {
        const variants = (p.product_variants ?? []).filter((v: any) => v.status === "active");
        const prices = variants.map((v: any) => Number(v.discount_price ?? v.price)).filter(Number.isFinite);
        const onSale = variants.some((v: any) => v.discount_price && Number(v.discount_price) < Number(v.price));
        const inv = Array.isArray(p.product_inventory) ? p.product_inventory[0] : p.product_inventory;
        const stock = Number(inv?.available_stock_ml ?? 0);
        return { ...p, _minPrice: prices.length ? Math.min(...prices) : null, _onSale: onSale, _stock: stock };
      });
      if (params.min_price > 0) rows = rows.filter((p) => p._minPrice !== null && p._minPrice >= params.min_price);
      if (params.max_price > 0) rows = rows.filter((p) => p._minPrice !== null && p._minPrice <= params.max_price);
      if (params.in_stock) rows = rows.filter((p) => p._stock > 0);
      if (params.on_sale) rows = rows.filter((p) => p._onSale);

      // sort
      if (params.sort === "price_asc") rows.sort((a, b) => (a._minPrice ?? Infinity) - (b._minPrice ?? Infinity));
      else if (params.sort === "price_desc") rows.sort((a, b) => (b._minPrice ?? -Infinity) - (a._minPrice ?? -Infinity));
      else if (params.sort === "name") rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "fa"));
      // newest: rely on default order from DB (no created_at selected here — keep as-is)

      setItems(rows);
    })();
    return () => { cancelled = true; };
  }, [params]);

  const setParam = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    navigate({ search: (prev: any) => ({ ...prev, [key]: value }) });
  };
  const toggleArr = (key: "brands" | "notes" | "stores", id: string) => {
    const cur = params[key] as string[];
    setParam(key, (cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id]) as any);
  };

  const activeCount = useMemo(() => {
    let n = 0;
    if (params.q) n++;
    n += params.brands.length + params.notes.length + params.stores.length;
    if (params.gender !== "any") n++;
    if (params.concentration !== "any") n++;
    if (params.min_price > 0) n++;
    if (params.max_price > 0) n++;
    if (params.in_stock) n++;
    if (params.on_sale) n++;
    return n;
  }, [params]);

  const reset = () => navigate({ search: {} as any });

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-6">
          <h1 className="font-serif text-3xl md:text-4xl text-ink">جست‌وجو در رایحه‌ها</h1>
          <p className="text-muted-foreground font-serif italic mt-1 text-sm">با فیلتر، رایحه‌ای را پیدا کن که با شب‌ات می‌نشیند.</p>
        </header>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar — desktop */}
          <aside className={`paper-card rounded-md p-5 h-fit lg:sticky lg:top-24 ${mobileOpen ? "block" : "hidden"} lg:block`}>
            <FilterPanel
              params={params}
              setParam={setParam}
              toggleArr={toggleArr}
              brands={brands}
              notes={notes}
              stores={stores}
              onReset={reset}
              activeCount={activeCount}
            />
          </aside>

          <div className="space-y-4">
            {/* Top bar */}
            <div className="paper-card rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
                <Input
                  value={params.q}
                  onChange={(e) => setParam("q", e.target.value)}
                  placeholder="نام رایحه، توضیح…"
                  className="pr-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={params.sort} onValueChange={(v) => setParam("sort", v as any)}>
                  <SelectTrigger className="w-[160px] h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">جدیدترین</SelectItem>
                    <SelectItem value="price_asc">ارزان‌ترین</SelectItem>
                    <SelectItem value="price_desc">گران‌ترین</SelectItem>
                    <SelectItem value="name">نام (الفبا)</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="lg:hidden h-10" onClick={() => setMobileOpen((s) => !s)}>
                  <SlidersHorizontal className="w-4 h-4 ml-1" />
                  فیلترها {activeCount > 0 && <span className="ms-1 text-[var(--gold)]">({activeCount.toLocaleString("fa-IR")})</span>}
                </Button>
              </div>
            </div>

            {/* Active chips */}
            {activeCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {params.q && <Chip label={`«${params.q}»`} onClear={() => setParam("q", "")} />}
                {params.gender !== "any" && <Chip label={genderLabel(params.gender)} onClear={() => setParam("gender", "any")} />}
                {params.concentration !== "any" && <Chip label={params.concentration.toUpperCase()} onClear={() => setParam("concentration", "any")} />}
                {params.in_stock && <Chip label="موجود" onClear={() => setParam("in_stock", false)} />}
                {params.on_sale && <Chip label="تخفیف‌دار" onClear={() => setParam("on_sale", false)} />}
                {params.min_price > 0 && <Chip label={`از ${formatToman(params.min_price)}`} onClear={() => setParam("min_price", 0)} />}
                {params.max_price > 0 && <Chip label={`تا ${formatToman(params.max_price)}`} onClear={() => setParam("max_price", 0)} />}
                {params.brands.map((id: string) => {
                  const b = brands.find((x) => x.id === id);
                  return <Chip key={id} label={b?.name ?? "برند"} onClear={() => toggleArr("brands", id)} />;
                })}
                {params.notes.map((id: string) => {
                  const n = notes.find((x) => x.id === id);
                  return <Chip key={id} label={n?.name ?? "نُت"} onClear={() => toggleArr("notes", id)} />;
                })}
                {params.stores.map((id: string) => {
                  const s = stores.find((x) => x.id === id);
                  return <Chip key={id} label={s?.store_name ?? "عطاری"} onClear={() => toggleArr("stores", id)} />;
                })}
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-ink underline font-serif">حذف همه</button>
              </div>
            )}

            {/* Results */}
            {items === null ? (
              <LoadingState label="جست‌وجو میان رایحه‌ها…" />
            ) : items.length === 0 ? (
              <EmptyState title="رایحه‌ای با این فیلترها نبود" message="فیلترها را آرام‌تر کن یا کلمه‌ی دیگری امتحان کن." icon={<SearchIcon className="w-8 h-8" />} />
            ) : (
              <>
                <p className="text-xs text-muted-foreground font-serif">{items.length.toLocaleString("fa-IR")} رایحه یافته شد</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {items.map((p) => (
                    <Link key={p.id} to="/products/$slug" params={{ slug: p.slug }} className="paper-card rounded-md p-3 relative hover:border-[var(--gold)] transition group">
                      <WishlistButton productId={p.id} />
                      <div className="aspect-square bg-[var(--moon)]/40 rounded-sm mb-3 flex items-center justify-center text-[var(--gold)]/60 overflow-hidden">
                        {p.main_image_url
                          ? <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" />
                          : <Sparkles className="w-8 h-8" />}
                      </div>
                      {p.brands?.name && <p className="text-[10px] tracking-widest uppercase text-[var(--gold)]">{p.brands.name}</p>}
                      <h3 className="font-serif text-ink text-sm truncate mt-0.5">{p.name}</h3>
                      <p className="text-[11px] text-muted-foreground truncate">{p.stores?.store_name}</p>
                      <div className="flex items-center justify-between mt-2">
                        {p._minPrice !== null
                          ? <p className="text-sm text-[var(--gold)] font-serif">{formatToman(p._minPrice)}</p>
                          : <span className="text-xs text-muted-foreground">—</span>}
                        {p._onSale && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--gold)]/15 text-[var(--gold-deep)] font-serif">تخفیف</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function genderLabel(g: string) {
  return g === "male" ? "مردانه" : g === "female" ? "زنانه" : g === "unisex" ? "یونیسکس" : g;
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-serif px-2.5 py-1 rounded-full border border-ink/15 bg-[var(--paper)]">
      {label}
      <button onClick={onClear} aria-label="حذف فیلتر" className="text-ink/50 hover:text-destructive"><X className="w-3 h-3" /></button>
    </span>
  );
}

function FilterPanel({
  params, setParam, toggleArr, brands, notes, stores, onReset, activeCount,
}: {
  params: SearchParams;
  setParam: <K extends keyof SearchParams>(k: K, v: SearchParams[K]) => void;
  toggleArr: (k: "brands" | "notes" | "stores", id: string) => void;
  brands: { id: string; name: string }[];
  notes: { id: string; name: string; type: string }[];
  stores: { id: string; store_name: string }[];
  onReset: () => void;
  activeCount: number;
}) {
  const noteGroups: Record<string, { id: string; name: string }[]> = { top: [], middle: [], base: [], general: [] };
  notes.forEach((n) => { (noteGroups[n.type] ?? noteGroups.general).push(n); });
  const noteLabel: Record<string, string> = { top: "آغازین", middle: "میانی", base: "پایه", general: "عمومی" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-ink">فیلترها</h2>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-muted-foreground hover:text-destructive font-serif underline">پاکسازی</button>
        )}
      </div>

      <Group title="جنسیت">
        <Select value={params.gender} onValueChange={(v) => setParam("gender", v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">همه</SelectItem>
            <SelectItem value="male">مردانه</SelectItem>
            <SelectItem value="female">زنانه</SelectItem>
            <SelectItem value="unisex">یونیسکس</SelectItem>
          </SelectContent>
        </Select>
      </Group>

      <Group title="غلظت">
        <Select value={params.concentration} onValueChange={(v) => setParam("concentration", v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">همه</SelectItem>
            <SelectItem value="edt">EDT</SelectItem>
            <SelectItem value="edp">EDP</SelectItem>
            <SelectItem value="parfum">Parfum</SelectItem>
            <SelectItem value="extrait">Extrait</SelectItem>
            <SelectItem value="cologne">Cologne</SelectItem>
          </SelectContent>
        </Select>
      </Group>

      <Group title="بازه‌ی قیمت (تومان)">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-ink/70">از</Label>
            <Input type="number" min={0} dir="ltr" value={params.min_price || ""} onChange={(e) => setParam("min_price", Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-[11px] text-ink/70">تا</Label>
            <Input type="number" min={0} dir="ltr" value={params.max_price || ""} onChange={(e) => setParam("max_price", Number(e.target.value) || 0)} />
          </div>
        </div>
      </Group>

      <Group title="وضعیت">
        <label className="flex items-center gap-2 text-sm font-serif text-ink cursor-pointer">
          <Checkbox checked={params.in_stock} onCheckedChange={(v) => setParam("in_stock", !!v)} /> فقط موجود
        </label>
        <label className="flex items-center gap-2 text-sm font-serif text-ink cursor-pointer mt-2">
          <Checkbox checked={params.on_sale} onCheckedChange={(v) => setParam("on_sale", !!v)} /> فقط تخفیف‌دار
        </label>
      </Group>

      {brands.length > 0 && (
        <Group title={`برندها (${brands.length.toLocaleString("fa-IR")})`} scroll>
          {brands.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm font-serif text-ink py-0.5 cursor-pointer">
              <Checkbox checked={params.brands.includes(b.id)} onCheckedChange={() => toggleArr("brands", b.id)} />
              <span className="truncate">{b.name}</span>
            </label>
          ))}
        </Group>
      )}

      {stores.length > 0 && (
        <Group title="عطاری‌ها" scroll>
          {stores.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm font-serif text-ink py-0.5 cursor-pointer">
              <Checkbox checked={params.stores.includes(s.id)} onCheckedChange={() => toggleArr("stores", s.id)} />
              <span className="truncate">{s.store_name}</span>
            </label>
          ))}
        </Group>
      )}

      {notes.length > 0 && (
        <Group title="نُت‌های عطر" scroll>
          {(["top", "middle", "base", "general"] as const).map((g) =>
            noteGroups[g].length ? (
              <div key={g} className="mb-2">
                <p className="text-[10px] tracking-widest uppercase text-[var(--gold)] mb-1">{noteLabel[g]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {noteGroups[g].map((n) => {
                    const on = params.notes.includes(n.id);
                    return (
                      <button key={n.id} type="button" onClick={() => toggleArr("notes", n.id)}
                        className={`px-2.5 py-1 text-xs rounded-sm border font-serif transition ${on ? "bg-ink text-[var(--paper)] border-ink" : "border-ink/15 text-ink hover:border-[var(--gold)]"}`}>
                        {n.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div>
      <p className="text-xs font-serif text-ink/80 mb-2">{title}</p>
      <div className={scroll ? "max-h-44 overflow-auto pr-1" : ""}>{children}</div>
    </div>
  );
}