import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/seller-utils";

type Variant = { id?: string; bottle_type_id: string; volume_ml: number; price: number; discount_price: number | null; status: "active" | "inactive" };

export function ProductEditor({ productId }: { productId?: string }) {
  const { storeId, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [bottles, setBottles] = useState<any[]>([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", gender: "unisex", concentration: "edp",
    main_image_url: "", brand_id: "", status: "active",
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [stockMl, setStockMl] = useState(0);
  const [lowAlertMl, setLowAlertMl] = useState(50);

  useEffect(() => {
    (async () => {
      const [b, bt, n] = await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("bottle_types").select("id, name, volume_ml").order("volume_ml"),
        supabase.from("scent_notes").select("id, name, type").order("type"),
      ]);
      setBrands(b.data ?? []); setBottles(bt.data ?? []); setAllNotes(n.data ?? []);

      if (productId) {
        const { data: p } = await supabase.from("products").select("*, product_variants(*), product_scent_notes(scent_note_id), product_inventory(*)").eq("id", productId).single();
        if (p) {
          setForm({
            name: p.name, slug: p.slug, description: p.description ?? "",
            gender: p.gender, concentration: p.concentration,
            main_image_url: p.main_image_url ?? "", brand_id: p.brand_id ?? "", status: p.status,
          });
          setVariants((p.product_variants ?? []).map((v: any) => ({
            id: v.id, bottle_type_id: v.bottle_type_id, volume_ml: v.volume_ml,
            price: Number(v.price), discount_price: v.discount_price ? Number(v.discount_price) : null, status: v.status,
          })));
          setSelectedNotes(new Set((p.product_scent_notes ?? []).map((x: any) => x.scent_note_id)));
          const inv = (p.product_inventory as any)?.[0] ?? (p.product_inventory as any);
          if (inv) { setStockMl(inv.total_stock_ml); setLowAlertMl(inv.low_stock_alert_ml); }
        }
      }
      setLoading(false);
    })();
  }, [productId]);

  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const addVariant = () => {
    if (!bottles[0]) return;
    setVariants([...variants, { bottle_type_id: bottles[0].id, volume_ml: bottles[0].volume_ml, price: 0, discount_price: null, status: "active" }]);
  };
  const updateVariant = (i: number, patch: Partial<Variant>) => {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  };
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));

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
    const slug = (form.slug || slugify(form.name)).trim();
    setSaving(true);
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

    // variants: easiest = delete all & re-insert
    await supabase.from("product_variants").delete().eq("product_id", pid);
    if (variants.length) {
      const rows = variants.map((v) => ({
        product_id: pid, bottle_type_id: v.bottle_type_id, volume_ml: v.volume_ml,
        price: v.price, discount_price: v.discount_price, status: v.status,
      }));
      const r = await supabase.from("product_variants").insert(rows);
      if (r.error) { setSaving(false); toast.error(r.error.message); return; }
    }
    // notes
    await supabase.from("product_scent_notes").delete().eq("product_id", pid);
    if (selectedNotes.size) {
      await supabase.from("product_scent_notes").insert([...selectedNotes].map((nid) => ({ product_id: pid, scent_note_id: nid })));
    }
    // inventory
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

      <div className="paper-card rounded-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">حجم‌ها و بطری‌ها</h2>
          <Button size="sm" variant="outline" onClick={addVariant}><Plus className="w-4 h-4 ml-1" /> افزودن</Button>
        </div>
        {variants.length === 0 && <p className="text-sm text-muted-foreground">هنوز حجمی اضافه نشده.</p>}
        <div className="space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1.5fr_0.7fr_1fr_1fr_0.8fr_auto] gap-2 items-end p-3 border border-ink/10 rounded-sm">
              <Field label="بطری">
                <Select value={v.bottle_type_id} onValueChange={(val) => {
                  const bt = bottles.find((x) => x.id === val);
                  updateVariant(i, { bottle_type_id: val, volume_ml: bt?.volume_ml ?? v.volume_ml });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{bottles.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.volume_ml} ml)</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="حجم (ml)"><Input type="number" min={1} value={v.volume_ml} onChange={(e) => updateVariant(i, { volume_ml: Number(e.target.value) })} dir="ltr" /></Field>
              <Field label="قیمت (تومان)"><Input type="number" min={0} value={v.price} onChange={(e) => updateVariant(i, { price: Number(e.target.value) })} dir="ltr" /></Field>
              <Field label="قیمت تخفیف (اختیاری)"><Input type="number" min={0} value={v.discount_price ?? ""} onChange={(e) => updateVariant(i, { discount_price: e.target.value ? Number(e.target.value) : null })} dir="ltr" /></Field>
              <Field label="وضعیت">
                <Select value={v.status} onValueChange={(val: any) => updateVariant(i, { status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">فعال</SelectItem>
                    <SelectItem value="inactive">غیرفعال</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <button onClick={() => removeVariant(i)} className="p-2 text-ink/70 hover:text-destructive self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
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
        <Button disabled={saving} onClick={save}>{saving ? "ذخیره…" : "ذخیره"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><Label className="text-xs font-serif text-ink/80 mb-1.5 block">{label}</Label>{children}</div>);
}