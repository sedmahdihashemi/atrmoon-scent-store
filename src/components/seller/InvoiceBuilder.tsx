import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadingState } from "@/components/ui/loading-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronRight, Plus, Trash2, Download, Share2, Save, Settings2, FileText } from "lucide-react";
import { InvoicePaper } from "@/components/seller/InvoicePaper";
import { downloadInvoicePdf, shareInvoicePdf } from "@/lib/invoice-pdf";
import {
  type InvoiceItem,
  type InvoiceSettings,
  emptyItem,
  computeTotals,
  formatToman,
  newInvoiceNo,
} from "@/lib/invoice";

export function InvoiceBuilder({ invoiceId }: { invoiceId?: string }) {
  const { storeId, user } = useAuth();
  const navigate = useNavigate();
  const paperRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");
  const [settings, setSettings] = useState<InvoiceSettings>({ show_stamp: true });
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [id, setId] = useState<string | undefined>(invoiceId);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issuedAt, setIssuedAt] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [sourceOrderId, setSourceOrderId] = useState<string | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"download" | "share" | null>(null);

  // The invoice paper is a fixed 720px wide so the PDF stays crisp; for display
  // we scale it DOWN to fit the screen (phones), measuring the container and the
  // paper's natural height so the layout reserves the right amount of space.
  const previewOuterRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [paperH, setPaperH] = useState(0);

  // Load store identity/settings, recent orders, and (when editing) the invoice.
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const [{ data: store }, { data: ords }] = await Promise.all([
        supabase.from("stores").select("store_name, support_phone, address, invoice_settings").eq("id", storeId).single(),
        supabase.from("orders").select("id, order_number, customer_name, total_amount, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(40),
      ]);
      const sName = (store as any)?.store_name ?? "";
      setStoreName(sName);
      const saved = ((store as any)?.invoice_settings ?? null) as InvoiceSettings | null;
      setSettings(
        saved ?? {
          header_name: sName,
          phone: (store as any)?.support_phone ?? "",
          address: (store as any)?.address ?? "",
          footer_note: "",
          show_stamp: true,
        }
      );
      setOrders(ords ?? []);

      if (invoiceId) {
        const { data: inv } = await supabase.from("seller_invoices").select("*").eq("id", invoiceId).single();
        if (inv) {
          setInvoiceNo(inv.invoice_no);
          setIssuedAt(inv.issued_at);
          setCustomerName(inv.customer_name ?? "");
          setCustomerPhone(inv.customer_phone ?? "");
          setCustomerNote(inv.customer_note ?? "");
          setItems(Array.isArray(inv.items) && (inv.items as any[]).length ? (inv.items as unknown as InvoiceItem[]) : [emptyItem()]);
          setDiscount(Number(inv.discount_toman) || 0);
          setShipping(Number(inv.shipping_toman) || 0);
          setSourceOrderId(inv.source_order_id ?? null);
        } else {
          toast.error("فاکتور پیدا نشد");
          navigate({ to: "/seller/invoices" });
          return;
        }
      } else {
        setInvoiceNo(newInvoiceNo());
        setIssuedAt(new Date().toISOString());
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, invoiceId]);

  const { subtotal, total } = useMemo(() => computeTotals(items, discount, shipping), [items, discount, shipping]);

  // Keep the scaled preview fitting its column on any screen size.
  useEffect(() => {
    if (loading) return;
    const outer = previewOuterRef.current;
    const paper = paperRef.current;
    if (!outer || !paper) return;
    const recompute = () => {
      const w = outer.clientWidth;
      setScale(Math.min(1, w > 0 ? w / 720 : 1));
      setPaperH(paper.offsetHeight);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(outer);
    ro.observe(paper);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [loading]);

  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (i: number) => setItems((arr) => (arr.length === 1 ? [emptyItem()] : arr.filter((_, idx) => idx !== i)));

  // Prefill the whole item list from an existing order.
  const prefillFromOrder = async (orderId: string) => {
    const { data: o } = await supabase.from("orders").select("customer_name, customer_phone").eq("id", orderId).single();
    const { data: oi } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    const list = (oi ?? []) as any[];
    if (!list.length) { toast.error("این سفارش قلمی ندارد"); return; }
    setItems(
      list.map((it) => ({
        title: `${it.product_name} — ${it.volume_ml} میلی‌لیتر${it.no_bottle ? " (بدون شیشه)" : it.bottle_name ? ` · ${it.bottle_name}` : ""}`,
        qty: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || (it.quantity ? Math.round(Number(it.total_price) / Number(it.quantity)) : 0),
        note: "",
      }))
    );
    if (o) {
      setCustomerName((o as any).customer_name ?? "");
      setCustomerPhone((o as any).customer_phone ?? "");
    }
    setSourceOrderId(orderId);
    setDiscount(0);
    setShipping(0);
    toast.success("اقلام سفارش بارگذاری شد");
  };

  const cleanItems = (): InvoiceItem[] =>
    items
      .map((it) => ({ title: it.title.trim(), qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0, note: it.note?.trim() || "" }))
      .filter((it) => it.title || it.unit_price > 0);

  const save = async (): Promise<string | null> => {
    if (!storeId) return null;
    const payloadItems = cleanItems();
    if (payloadItems.length === 0) { toast.error("حداقل یک قلم با عنوان یا قیمت وارد کنید"); return null; }
    const t = computeTotals(payloadItems, discount, shipping);
    setSaving(true);
    const row = {
      store_id: storeId,
      created_by: user?.id ?? null,
      invoice_no: invoiceNo,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      customer_note: customerNote.trim() || null,
      items: payloadItems as any,
      discount_toman: Number(discount) || 0,
      shipping_toman: Number(shipping) || 0,
      subtotal_toman: t.subtotal,
      total_toman: t.total,
      source_order_id: sourceOrderId,
      issued_at: issuedAt || new Date().toISOString(),
    };
    let savedId = id;
    if (id) {
      const { error } = await supabase.from("seller_invoices").update(row).eq("id", id);
      if (error) { setSaving(false); toast.error(error.message); return null; }
    } else {
      const { data, error } = await supabase.from("seller_invoices").insert(row).select("id").single();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? "خطا در ذخیره"); return null; }
      savedId = data.id;
      setId(data.id);
      window.history.replaceState(null, "", `/seller/invoices/${data.id}`);
    }
    setSaving(false);
    toast.success("فاکتور ذخیره شد");
    return savedId ?? null;
  };

  const saveSettings = async () => {
    if (!storeId) return;
    setSavingSettings(true);
    const clean: InvoiceSettings = {
      header_name: settings.header_name?.trim() || undefined,
      phone: settings.phone?.trim() || undefined,
      address: settings.address?.trim() || undefined,
      footer_note: settings.footer_note?.trim() || undefined,
      show_stamp: settings.show_stamp !== false,
    };
    const { error } = await supabase.from("stores").update({ invoice_settings: clean as any }).eq("id", storeId);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تنظیمات فاکتور ذخیره شد");
    setShowSettings(false);
  };

  const doPdf = async (mode: "download" | "share") => {
    // Make sure the latest numbers are persisted before exporting.
    await save();
    const node = paperRef.current;
    if (!node) return;
    setPdfBusy(mode);
    const filename = `factor-${invoiceNo}.pdf`;
    try {
      if (mode === "download") {
        await downloadInvoicePdf(node, filename);
        toast.success("PDF دانلود شد");
      } else {
        const res = await shareInvoicePdf(node, filename, `فاکتور ${invoiceNo}`);
        toast.success(res === "shared" ? "فاکتور به اشتراک گذاشته شد" : "اشتراک‌گذاری در دسترس نبود؛ PDF دانلود شد");
      }
    } catch (e: any) {
      console.error("[invoice pdf]", e);
      toast.error("ساخت PDF ناموفق بود");
    } finally {
      setPdfBusy(null);
    }
  };

  if (loading) return <LoadingState />;

  const previewItems = cleanItems();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/seller/invoices" className="hover:text-[var(--gold)]">فاکتورها</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span className="text-ink">{id ? "ویرایش فاکتور" : "فاکتور جدید"}</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_minmax(320px,0.9fr)] gap-6 items-start">
        {/* ------------------------------ Editor ------------------------------ */}
        <div className="space-y-5 min-w-0">
          {/* From order */}
          <div className="paper-card rounded-md p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--gold)]" /> ساخت از روی سفارش</h2>
              <button onClick={() => setShowSettings((v) => !v)} className="text-xs text-[var(--gold-deep)] hover:underline flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" /> شخصی‌سازی فاکتور</button>
            </div>
            <Select onValueChange={prefillFromOrder}>
              <SelectTrigger><SelectValue placeholder="یک سفارش را انتخاب کنید (اختیاری)…" /></SelectTrigger>
              <SelectContent>
                {orders.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">سفارشی موجود نیست</div>
                ) : (
                  orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name || "بدون نام"} ({formatToman(o.total_amount)})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">اقلام را خودکار پر می‌کند؛ بعد می‌توانید آزادانه ویرایش کنید.</p>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="paper-card rounded-md p-5 space-y-3 border border-[var(--gold)]/30">
              <h3 className="font-serif text-base text-ink">شخصی‌سازی فاکتورِ عطاری</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="نام روی فاکتور">
                  <Input value={settings.header_name ?? ""} onChange={(e) => setSettings({ ...settings, header_name: e.target.value })} placeholder={storeName} />
                </Field>
                <Field label="تلفن">
                  <Input value={settings.phone ?? ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} dir="ltr" />
                </Field>
              </div>
              <Field label="نشانی">
                <Input value={settings.address ?? ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
              </Field>
              <Field label="یادداشت پایانی فاکتور">
                <Textarea rows={2} value={settings.footer_note ?? ""} onChange={(e) => setSettings({ ...settings, footer_note: e.target.value })} placeholder="مثلاً: ضمانت اصالت کالا — مرجوعی تا ۷ روز" />
              </Field>
              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-serif text-ink">نمایش مُهر عطرمون روی فاکتور</span>
                <Switch checked={settings.show_stamp !== false} onCheckedChange={(v) => setSettings({ ...settings, show_stamp: v })} />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>انصراف</Button>
                <Button size="sm" loading={savingSettings} onClick={saveSettings}>ذخیره تنظیمات</Button>
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="paper-card rounded-md p-5 space-y-3">
            <h2 className="font-serif text-lg text-ink">مشتری</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="نام مشتری"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
              <Field label="تلفن مشتری"><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="شماره فاکتور"><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} dir="ltr" /></Field>
            </div>
          </div>

          {/* Items */}
          <div className="paper-card rounded-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-ink">اقلام فاکتور</h2>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="w-4 h-4" /> افزودن قلم</Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-sm border border-ink/10 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground mt-2.5 w-5 shrink-0 text-center">{i + 1}</span>
                    <Input className="flex-1" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} placeholder="شرح کالا (مثلاً: ساواج دیور ۳۰ میل)" />
                    <button onClick={() => removeItem(i)} aria-label="حذف" className="mt-1.5 w-8 h-8 rounded-sm flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50 transition shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-2 pr-7">
                    <Field label="تعداد" className="w-20 shrink-0">
                      <Input type="number" inputMode="numeric" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                    </Field>
                    <Field label="قیمت واحد (تومان)" className="flex-1">
                      <Input type="number" inputMode="numeric" min={0} value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} dir="ltr" />
                    </Field>
                    <Field label="جمع" className="w-28 shrink-0">
                      <div className="h-9 flex items-center px-2 text-sm text-[var(--gold-deep)] font-serif">{formatToman((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</div>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <div className="paper-card rounded-md p-5 space-y-3">
            <h2 className="font-serif text-lg text-ink">مبالغ</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="تخفیف (تومان)"><Input type="number" inputMode="numeric" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} dir="ltr" /></Field>
              <Field label="هزینه ارسال (تومان)"><Input type="number" inputMode="numeric" min={0} value={shipping} onChange={(e) => setShipping(Number(e.target.value) || 0)} dir="ltr" /></Field>
            </div>
            <Field label="توضیحات (روی فاکتور دیده می‌شود)"><Textarea rows={2} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} /></Field>
            <div className="flex justify-between items-center pt-2 border-t border-ink/10 font-serif">
              <span className="text-ink">مبلغ قابل پرداخت</span>
              <span className="text-lg text-[var(--gold-deep)]">{formatToman(total)} تومان</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={saving} className="gap-1.5"><Save className="w-4 h-4" /> ذخیره</Button>
            <Button variant="outline" onClick={() => doPdf("download")} loading={pdfBusy === "download"} loadingText="در حال ساخت…" className="gap-1.5"><Download className="w-4 h-4" /> دانلود PDF</Button>
            <Button variant="outline" onClick={() => doPdf("share")} loading={pdfBusy === "share"} loadingText="آماده‌سازی…" className="gap-1.5"><Share2 className="w-4 h-4" /> اشتراک‌گذاری</Button>
          </div>
        </div>

        {/* ------------------------------ Preview ----------------------------- */}
        <div className="lg:sticky lg:top-24">
          <p className="text-xs text-muted-foreground mb-2 text-center">پیش‌نمایش فاکتور</p>
          <div ref={previewOuterRef} className="rounded-md bg-ink/5 p-2 sm:p-3 overflow-hidden">
            {/* Outer box reserves the SCALED height; the inner node stays 720px
                wide (for a crisp PDF) and is visually scaled to fit. */}
            <div style={{ position: "relative", width: "100%", height: paperH ? paperH * scale : undefined }}>
              <div
                style={{
                  position: paperH ? "absolute" : "relative",
                  top: 0,
                  left: "50%",
                  width: 720,
                  marginLeft: -360,
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                }}
              >
                <InvoicePaper
                  ref={paperRef}
                  settings={settings}
                  storeName={storeName}
                  invoiceNo={invoiceNo}
                  issuedAt={issuedAt}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  customerNote={customerNote}
                  items={previewItems}
                  discount={discount}
                  shipping={shipping}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">جمع جزء: {formatToman(subtotal)} تومان</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
