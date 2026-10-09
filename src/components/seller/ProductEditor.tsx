import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wine } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/seller-utils";
import { formatToman } from "@/lib/cart-session";
import { computeVariantPrice } from "@/lib/pricing";

type StoreBottle = { id: string; name: string; volume_ml: number; photo_url: string | null; cost_toman: number | null; profit_percent: number };
type VSel = { id?: string; store_bottle_id: string; price: string; discount_price: string };

export function ProductEditor({ productId }: { productId?: string }) {
  const { storeId, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [storeBottles, setStoreBottles] = useState<StoreBottle[] | null>(null);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [pricingMode, setPricingMode] = useState<"manual" | "formula">("manual");
  const [form, setForm] = useState({
    name: "", slug: "", description: "", gender: "unisex", concentration: "edp",
    main_image_url: "", brand_id: "", status: "active",
  });
  const [oil, setOil] = useState({ cost_per_gram: "", concentration: "50", oil_profit: "0" });
  const [selected, setSelected] = useState<VSel[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [stockMl, setStockMl] = useState(0);
  const [lowAlertMl, setLowAlertMl] = useState(50);

  // Product + reference data (brands/notes) + this product's oil settings.
  useEffect(() => {
    (async () => {
      const [b, n] = await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("scent_notes").select("id, name, type").order("type"),
      ]);
      setBrands(b.data ?? []); setAllNotes(n.data ?? []);

      if (productId) {
        const { data: p } = await supabase.from("products").select("*, product_variants(*), product_scent_notes(scent_note_id), product_inventory(*)").eq("id", productId).single();
        if (p) {
          setForm({
            name: p.name, slug: p.slug, description: p.description ?? "",
            gender: p.gender, concentration: p.concentration,
            main_image_url: p.main_image_url ?? "", brand_id: p.brand_id ?? "", status: p.status,
          });
          setSelected((p.product_variants ?? [])
            .filter((v: any) => v.store_bottle_id)
            .map((v: any) => ({
              id: v.id, store_bottle_id: v.store_bottle_id,
              price: String(Number(v.price)), discount_price: v.discount_price ? String(Number(v.discount_price)) : "",
            })));
          setSelectedNotes(new Set((p.product_scent_notes ?? []).map((x: any) => x.scent_note_id)));
          const inv = (p.product_inventory as any)?.[0] ?? (p.product_inventory as any);
          if (inv) { setStockMl(inv.total_stock_ml); setLowAlertMl(inv.low_stock_alert_ml); }
        }
        const { data: pps } = await supabase.from("product_pricing_settings").select("*").eq("product_id", productId).maybeSingle();
        if (pps) setOil({
          cost_per_gram: (pps as any).cost_per_gram_toman == null ? "" : String((pps as any).cost_per_gram_toman),
          concentration: String((pps as any).concentration_percent ?? 50),
          oil_profit: String((pps as any).oil_profit_percent ?? 0),
        });
      }
      setLoading(false);
    })();
  }, [productId]);

  // Store-scoped data: the shop's own bottles + its pricing mode.
  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      supabase.from("store_bottles").select("id, name, volume_ml, photo_url, cost_toman, profit_percent").eq("store_id", storeId).eq("is_active", true).order("volume_ml"),
      supabase.from("store_pricing_settings").select("pricing_mode").eq("store_id", storeId).maybeSingle(),
    ]).then(([sb, sps]) => {
      setStoreBottles((sb.data ?? []) as StoreBottle[]);
      setPricingMode((sps.data as any)?.pricing_mode === "formula" ? "formula" : "manual");
    });
  }, [storeId]);

  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const isSelected = (bid: string) => selected.some((s) => s.store_bottle_id === bid);
  const toggleBottle = (bid: string) =>
    setSelected((prev) => isSelected(bid) ? prev.filter((s) => s.store_bottle_id !== bid) : [...prev, { store_bottle_id: bid, price: "", discount_price: "" }]);
  const updateSel = (bid: string, patch: Partial<VSel>) =>
    setSelected((prev) => prev.map((s) => s.store_bottle_id === bid ? { ...s, ...patch } : s));

  // Formula price for one bottle, using the SAME shared function the server
  // recompute uses — so this live preview equals the saved price exactly.
  const computeFor = (b: StoreBottle) => computeVariantPrice({
    volumeMl: b.volume_ml,
    concentrationPercent: Number(oil.concentration),
    costPerGramToman: oil.cost_per_gram.trim() === "" ? null : Number(oil.cost_per_gram),
    oilProfitPercent: Number(oil.oil_profit || 0),
    bottleCostToman: b.cost_toman,
    bottleProfitPercent: Number(b.profit_percent || 0),
  });

  const toggleNote = (id: string) => {
    const s = new Set(selectedNotes);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedNotes(s);
  };

  const onUpload = async (file: File) => {
    if (!user) { toast.error("ابتدا وارد شوید"); return; }
    if (!file.type.startsWith("image/")) { toast.error("فقط فایل تصویری"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("حداکثر حجم ۵ مگابایت"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, main_image_url: data.publicUrl }));
    setUploading(false);
    toast.success("تصویر بارگذاری شد");
  };

  const save = async () => {
    if (!storeId) return;
    if (!form.name.trim()) { toast.error("نام رایحه ضروری است"); return; }
    if (selected.length === 0) { toast.error("حداقل یک شیشه برای این عطر انتخاب کنید"); return; }

    const bottleById = new Map((storeBottles ?? []).map((b) => [b.id, b]));

    // Build variant rows, computing price in formula mode with the shared formula.
    const rows: any[] = [];
    const uncomputable: string[] = [];
    for (const sel of selected) {
      const b = bottleById.get(sel.store_bottle_id);
      if (!b) continue;
      let price: number;
      if (pricingMode === "formula") {
        const bd = computeFor(b);
        if (!bd) { uncomputable.push(b.name); continue; }
        price = bd.finalPrice;
      } else {
        price = Number(sel.price) || 0;
      }
      rows.push({
        store_bottle_id: b.id,
        bottle_type_id: null,
        volume_ml: b.volume_ml,
        bottle_name: b.name,
        bottle_photo_url: b.photo_url,
        price,
        discount_price: sel.discount_price.trim() === "" ? null : Number(sel.discount_price),
        status: "active",
      });
    }
    if (pricingMode === "formula" && uncomputable.length) {
      toast.error("قیمت این شیشه‌ها محاسبه نشد (هزینه‌ی شیشه در تب شیشه‌ها یا هزینه‌ی هر گرم عطر خالی است): " + uncomputable.join("، "));
      return;
    }
    if (rows.length === 0) { toast.error("هیچ شیشه‌ی قابل‌ذخیره‌ای نیست"); return; }

    setSaving(true);
    const slug = (form.slug || slugify(form.name)).trim();
    let pid = productId;
    const payload: any = {
      store_id: storeId, name: form.name.trim(), slug,
      description: form.description || null, gender: form.gender, concentration: form.concentration,
      main_image_url: form.main_image_url || null, brand_id: form.brand_id || null, status: form.status,
    };
    if (pid) {
      const { error } = await supabase.from("products").update(payload).eq("id", pid);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? "خطا"); return; }
      pid = data.id;
    }

    // Per-product oil settings (used by the formula; harmless in manual mode).
    const { error: ppsErr } = await supabase.from("product_pricing_settings").upsert({
      product_id: pid,
      cost_per_gram_toman: oil.cost_per_gram.trim() === "" ? null : Number(oil.cost_per_gram),
      concentration_percent: Number(oil.concentration) || 50,
      oil_profit_percent: Number(oil.oil_profit) || 0,
    }, { onConflict: "product_id" });
    if (ppsErr) { setSaving(false); toast.error(ppsErr.message); return; }

    // Variants: simplest reliable approach = delete all & re-insert.
    await supabase.from("product_variants").delete().eq("product_id", pid);
    const r = await supabase.from("product_variants").insert(rows.map((x) => ({ ...x, product_id: pid })));
    if (r.error) { setSaving(false); toast.error(r.error.message); return; }

    await supabase.from("product_scent_notes").delete().eq("product_id", pid);
    if (selectedNotes.size) {
      await supabase.from("product_scent_notes").insert([...selectedNotes].map((nid) => ({ product_id: pid, scent_note_id: nid })));
    }

    const inv = await supabase.from("product_inventory").select("id, reserved_stock_ml").eq("product_id", pid).maybeSingle();
    if (inv.data) {
      await supabase.from("product_inventory").update({
        total_stock_ml: stockMl, available_stock_ml: Math.max(0, stockMl - (inv.data.reserved_stock_ml ?? 0)),
        low_stock_alert_ml: lowAlertMl,
      }).eq("id", inv.data.id);
    } else {
      await supabase.from("product_inventory").insert({
        product_id: pid, store_id: storeId, total_stock_ml: stockMl,
        available_stock_ml: stockMl, reserved_stock_ml: 0, low_stock_alert_ml: lowAlertMl,
      });
    }
    setSaving(false);
    toast.success("ذخیره شد");
    navigate({ to: "/seller/products" });
  };

  if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">در حال آماده‌سازی…</p>;

  return (
    <div className="space-y-6">
      <div className="paper-card rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg text-ink">جزئیات رایحه</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="نام رایحه *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="نشانی یکتا (slug)"><Input value={form.slug} dir="ltr" onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto" /></Field>
          <Field label="برند">
            <Select value={form.brand_id || "none"} onValueChange={(v) => setForm({ ...form, brand_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون برند —</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="جنسیت">
            <Select value={form.gender} onValueChange={set("gender")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unisex">یونیسکس</SelectItem>
                <SelectItem value="male">مردانه</SelectItem>
                <SelectItem value="female">زنانه</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="غلظت">
            <Select value={form.concentration} onValueChange={set("concentration")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="edt">EDT</SelectItem>
                <SelectItem value="edp">EDP</SelectItem>
                <SelectItem value="parfum">Parfum</SelectItem>
                <SelectItem value="extrait">Extrait</SelectItem>
                <SelectItem value="cologne">Cologne</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="وضعیت">
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="draft">پیش‌نویس</SelectItem>
                <SelectItem value="inactive">غیرفعال</SelectItem>
                <SelectItem value="out_of_stock">ناموجود</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="تصویر اصلی">
              <div className="flex flex-col sm:flex-row items-start gap-3">
                {form.main_image_url ? (
                  <div className="relative">
                    <img src={form.main_image_url} alt="" className="w-24 h-24 object-cover rounded-sm border border-ink/10" />
                    <button type="button" onClick={() => setForm({ ...form, main_image_url: "" })}
                      className="absolute -top-2 -left-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">×</button>
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-[var(--moon)]/40 rounded-sm border border-dashed border-ink/20 flex items-center justify-center text-xs text-ink/40">بدون تصویر</div>
                )}
                <div className="flex-1 w-full space-y-2">
                  <label className="inline-flex items-center justify-center px-3 py-2 text-sm rounded-sm border border-ink/15 cursor-pointer hover:border-[var(--gold)] font-serif">
                    {uploading ? "در حال بارگذاری…" : "بارگذاری تصویر"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
                  </label>
                  <Input value={form.main_image_url} dir="ltr" onChange={(e) => setForm({ ...form, main_image_url: e.target.value })} placeholder="یا نشانی تصویر https://..." />
                </div>
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="توصیف"><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        </div>
      </div>

      {pricingMode === "formula" && (
        <div className="paper-card rounded-md p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg text-ink">قیمت عطر (فرمول‌محور)</h2>
            <p className="text-xs text-muted-foreground font-serif mt-1">
              هزینه‌ی خام هر گرم عطر و درصد سود این عطر. قیمت هر شیشه خودکار از روی این‌ها و هزینه‌ی خود شیشه محاسبه می‌شود.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="هزینه‌ی هر گرم (تومان)"><Input dir="ltr" inputMode="numeric" value={oil.cost_per_gram} onChange={(e) => setOil({ ...oil, cost_per_gram: e.target.value })} /></Field>
            <Field label="درصد غلظت (٪)"><Input dir="ltr" inputMode="numeric" value={oil.concentration} onChange={(e) => setOil({ ...oil, concentration: e.target.value })} /></Field>
            <Field label="درصد سود عطر (٪)"><Input dir="ltr" inputMode="numeric" value={oil.oil_profit} onChange={(e) => setOil({ ...oil, oil_profit: e.target.value })} /></Field>
          </div>
        </div>
      )}

      <div className="paper-card rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg text-ink">شیشه‌های این عطر</h2>
        {storeBottles === null ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری شیشه‌ها…</p>
        ) : storeBottles.length === 0 ? (
          <div className="rounded-md border border-dashed border-ink/20 p-6 text-center space-y-3">
            <Wine className="w-7 h-7 mx-auto text-ink/30" />
            <p className="text-sm font-serif text-ink">هنوز شیشه‌ای نساخته‌اید. اول باید شیشه‌های فروشگاه را تعریف کنید.</p>
            <Link to="/seller/bottles"><Button variant="outline" className="gap-1"><Plus className="w-4 h-4" />ساخت شیشه</Button></Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-serif">
              شیشه‌هایی که این عطر در آن‌ها ارائه می‌شود را انتخاب کنید.
              {pricingMode === "manual"
                ? " قیمت هر شیشه را خودتان وارد کنید."
                : " قیمت هر شیشه خودکار محاسبه و نمایش داده می‌شود."}
            </p>
            {storeBottles.map((b) => {
              const sel = selected.find((s) => s.store_bottle_id === b.id);
              const on = !!sel;
              const bd = on && pricingMode === "formula" ? computeFor(b) : null;
              return (
                <div key={b.id} className={`rounded-md border p-3 transition-colors ${on ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-ink/15"}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggleBottle(b.id)} className="w-4 h-4 accent-[var(--gold-deep)] shrink-0" />
                    <div className="w-10 h-10 rounded-sm bg-[var(--moon)]/40 border border-ink/10 overflow-hidden flex items-center justify-center text-ink/30 shrink-0">
                      {b.photo_url ? <img src={b.photo_url} alt={b.name} className="w-full h-full object-cover" /> : <Wine className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-ink text-sm truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.volume_ml.toLocaleString("fa-IR")} میلی‌لیتر</p>
                    </div>
                    {on && pricingMode === "formula" && (
                      bd
                        ? <span className="font-serif text-[var(--gold-deep)] text-sm shrink-0">{formatToman(bd.finalPrice)}</span>
                        : <span className="text-destructive text-[11px] font-serif shrink-0 text-left">محاسبه نشد؛ هزینه‌ی شیشه یا عطر خالی است</span>
                    )}
                  </div>
                  {on && (
                    <div className="grid sm:grid-cols-2 gap-2 mt-3 ps-7">
                      {pricingMode === "manual" && (
                        <div>
                          <Label className="text-xs font-serif text-ink/80 mb-1 block">قیمت (تومان)</Label>
                          <Input dir="ltr" inputMode="numeric" value={sel!.price} onChange={(e) => updateSel(b.id, { price: e.target.value })} />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-serif text-ink/80 mb-1 block">قیمت تخفیف (اختیاری)</Label>
                        <Input dir="ltr" inputMode="numeric" value={sel!.discount_price} onChange={(e) => updateSel(b.id, { discount_price: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="paper-card rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg text-ink">موجودی</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="موجودی کل (میلی‌لیتر)"><Input type="number" min={0} value={stockMl} dir="ltr" onChange={(e) => setStockMl(Number(e.target.value))} /></Field>
          <Field label="هشدار موجودی کم (میلی‌لیتر)"><Input type="number" min={0} value={lowAlertMl} dir="ltr" onChange={(e) => setLowAlertMl(Number(e.target.value))} /></Field>
        </div>
      </div>

      <div className="paper-card rounded-md p-5 space-y-3">
        <h2 className="font-serif text-lg text-ink">نُت‌های عطر</h2>
        {(["top","middle","base","general"] as const).map((t) => {
          const items = allNotes.filter((n) => n.type === t);
          const label = t === "top" ? "آغازین" : t === "middle" ? "میانی" : t === "base" ? "پایه" : "عمومی";
          return (
            <div key={t}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-xs font-serif text-[var(--gold)]">{label}</p>
                <AddNoteInline type={t} onAdded={(n) => { setAllNotes((a) => [...a, n]); setSelectedNotes((s) => new Set(s).add(n.id)); }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">نُتی ثبت نشده.</p>}
                {items.map((n) => {
                  const on = selectedNotes.has(n.id);
                  return (
                    <button key={n.id} type="button" onClick={() => toggleNote(n.id)}
                      className={`px-3 py-1 text-sm rounded-sm border font-serif transition ${on ? "bg-ink text-[var(--paper)] border-ink" : "border-ink/15 text-ink hover:border-[var(--gold)]"}`}>
                      {n.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => navigate({ to: "/seller/products" })}>انصراف</Button>
        <Button loading={saving} loadingText="ذخیره…" onClick={save}>ذخیره</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><Label className="text-xs font-serif text-ink/80 mb-1.5 block">{label}</Label>{children}</div>);
}

function AddNoteInline({ type, onAdded }: { type: "top"|"middle"|"base"|"general"; onAdded: (n: { id: string; name: string; type: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = name.trim();
    if (!v) return;
    setBusy(true);
    const { data, error } = await supabase.from("scent_notes").insert({ name: v, type }).select("id, name, type").single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "خطا"); return; }
    onAdded(data as any);
    setName(""); setOpen(false);
    toast.success("نُت افزوده شد");
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs text-ink/70 hover:text-[var(--gold)] font-serif inline-flex items-center gap-1"><Plus className="w-3 h-3" /> افزودن</button>;
  return (
    <div className="flex items-center gap-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام نُت" className="h-8 text-sm w-40"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} autoFocus />
      <Button size="sm" loading={busy} onClick={submit}>افزودن</Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setName(""); }}>انصراف</Button>
    </div>
  );
}
