import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { detectIranianBank } from "@/lib/iran-bank-cards";
import { BankIcon } from "@/lib/bank-icons";

const WEEKDAYS = [
  { value: "6", label: "شنبه" },
  { value: "0", label: "یکشنبه" },
  { value: "1", label: "دوشنبه" },
  { value: "2", label: "سه‌شنبه" },
  { value: "3", label: "چهارشنبه" },
  { value: "4", label: "پنجشنبه" },
  { value: "5", label: "جمعه" },
];

export const Route = createFileRoute("/seller/settings")({ component: SellerSettings });

function SellerSettings() {
  const { storeId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<any>({});
  const [confirmCardNumber, setConfirmCardNumber] = useState("");
  // Pricing engine settings (separate private table). Defaults mirror the DB.
  const [ps, setPs] = useState<any>({
    pricing_mode: "manual",
    usd_rate_toman: "",
    usd_auto_update_enabled: false,
    usd_update_day_of_week: "6",
    usd_auto_update_max_change_percent: "15",
  });

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      supabase.from("stores").select("*").eq("id", storeId).single(),
      supabase.from("store_pricing_settings").select("*").eq("store_id", storeId).maybeSingle(),
    ]).then(([storeRes, psRes]) => {
      setS(storeRes.data ?? {});
      setConfirmCardNumber((storeRes.data as any)?.card_number ?? "");
      if (psRes.data) {
        const d = psRes.data as any;
        setPs({
          pricing_mode: d.pricing_mode ?? "manual",
          usd_rate_toman: d.usd_rate_toman ?? "",
          usd_auto_update_enabled: !!d.usd_auto_update_enabled,
          usd_update_day_of_week: d.usd_update_day_of_week == null ? "6" : String(d.usd_update_day_of_week),
          usd_auto_update_max_change_percent: d.usd_auto_update_max_change_percent ?? "15",
        });
      }
      setLoading(false);
    });
  }, [storeId]);

  if (loading) return <LoadingState />;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    if (!storeId) return;

    // Card number is optional (empty = card-to-card disabled for this
    // store), but if it's set, it must be confirmed and have a holder name.
    const cardNumber = (s.card_number ?? "").replace(/[\s-]/g, "");
    if (cardNumber) {
      if (!/^\d{16}$/.test(cardNumber)) {
        toast.error("شماره کارت باید ۱۶ رقم باشد");
        return;
      }
      if (cardNumber !== confirmCardNumber.replace(/[\s-]/g, "")) {
        toast.error("شماره کارت و تکرار آن یکسان نیستند");
        return;
      }
      if (!s.card_holder_name?.trim()) {
        toast.error("نام صاحب کارت را وارد کنید");
        return;
      }
    }

    const usdRate = ps.usd_rate_toman === "" || ps.usd_rate_toman == null ? null : Number(ps.usd_rate_toman);
    if (usdRate != null && (!Number.isFinite(usdRate) || usdRate < 0)) {
      toast.error("نرخ دلار باید یک عدد معتبر باشد");
      return;
    }
    const maxChange = Number(ps.usd_auto_update_max_change_percent);
    if (!Number.isFinite(maxChange) || maxChange < 0) {
      toast.error("سقف درصد تغییر باید یک عدد معتبر باشد");
      return;
    }

    setSaving(true);
    // editable subset (status changes are admin-only)
    const { error } = await supabase.from("stores").update({
      store_name: s.store_name, description: s.description, logo_url: s.logo_url,
      city: s.city, address: s.address, support_phone: s.support_phone,
      support_email: s.support_email, whatsapp_number: s.whatsapp_number,
      instagram_url: s.instagram_url, telegram_id: s.telegram_id,
      card_number: cardNumber || null,
      card_holder_name: cardNumber ? s.card_holder_name.trim() : null,
    }).eq("id", storeId);
    if (error) { setSaving(false); toast.error(error.message); return; }

    const { error: psErr } = await supabase.from("store_pricing_settings").upsert({
      store_id: storeId,
      pricing_mode: ps.pricing_mode,
      usd_rate_toman: usdRate,
      usd_auto_update_enabled: !!ps.usd_auto_update_enabled,
      usd_update_day_of_week: Number(ps.usd_update_day_of_week),
      usd_auto_update_max_change_percent: maxChange,
    }, { onConflict: "store_id" });
    setSaving(false);
    if (psErr) toast.error(psErr.message); else toast.success("ذخیره شد");
  };

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink">تنظیمات فروشگاه</h2>
      <div className="paper-card rounded-md p-5 grid md:grid-cols-2 gap-4">
        <Field label="نام فروشگاه"><Input value={s.store_name ?? ""} onChange={set("store_name")} /></Field>
        <Field label="نشانی یکتا"><Input value={s.slug ?? ""} disabled dir="ltr" /></Field>
        <Field label="شهر"><Input value={s.city ?? ""} onChange={set("city")} /></Field>
        <Field label="ایمیل پشتیبانی"><Input value={s.support_email ?? ""} onChange={set("support_email")} dir="ltr" /></Field>
        <Field label="تلفن پشتیبانی"><Input value={s.support_phone ?? ""} onChange={set("support_phone")} dir="ltr" /></Field>
        <Field label="واتس‌اپ"><Input value={s.whatsapp_number ?? ""} onChange={set("whatsapp_number")} dir="ltr" /></Field>
        <Field label="اینستاگرام"><Input value={s.instagram_url ?? ""} onChange={set("instagram_url")} dir="ltr" /></Field>
        <Field label="آیدی تلگرام"><Input value={s.telegram_id ?? ""} onChange={set("telegram_id")} dir="ltr" /></Field>
        <div className="md:col-span-2">
          <Field label="نشانی"><Input value={s.address ?? ""} onChange={set("address")} /></Field>
        </div>
        <div className="md:col-span-2">
          <Field label="لوگو (URL)"><Input value={s.logo_url ?? ""} onChange={set("logo_url")} dir="ltr" /></Field>
        </div>
        <div className="md:col-span-2">
          <Field label="درباره"><Textarea rows={4} value={s.description ?? ""} onChange={set("description")} /></Field>
        </div>
      </div>

      <div className="paper-card rounded-md p-5">
        <h3 className="font-serif text-base text-ink mb-1">پرداخت کارت‌به‌کارت</h3>
        <p className="text-xs text-muted-foreground font-serif mb-4">
          اگر شماره کارت را خالی بگذارید، گزینه‌ی «کارت به کارت» در تسویه‌حساب برای مشتری‌های این فروشگاه نمایش داده نمی‌شود.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="نام صاحب کارت"><Input value={s.card_holder_name ?? ""} onChange={set("card_holder_name")} /></Field>
          <div />
          <Field label="شماره کارت (۱۶ رقم)">
            <Input value={s.card_number ?? ""} onChange={set("card_number")} dir="ltr" inputMode="numeric" placeholder="6037XXXXXXXXXXXX" />
            {detectIranianBank(s.card_number) && (
              <div className="flex items-center gap-1.5 mt-1">
                <BankIcon iconKey={detectIranianBank(s.card_number)!.iconKey} size={18} />
                <p className="text-xs text-muted-foreground font-serif">بانک: {detectIranianBank(s.card_number)!.name}</p>
              </div>
            )}
          </Field>
          <Field label="تکرار شماره کارت">
            <Input
              value={confirmCardNumber}
              onChange={(e) => setConfirmCardNumber(e.target.value)}
              dir="ltr"
              inputMode="numeric"
              placeholder="6037XXXXXXXXXXXX"
            />
          </Field>
        </div>
      </div>

      <div className="paper-card rounded-md p-5 space-y-4">
        <div>
          <h3 className="font-serif text-base text-ink mb-1">موتور قیمت‌گذاری</h3>
          <p className="text-xs text-muted-foreground font-serif">
            تعیین می‌کند قیمت محصولات چطور مشخص شود. تغییر حالت هر زمان ممکن است و قیمت‌های فعلی پاک نمی‌شوند.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPs({ ...ps, pricing_mode: "manual" })}
            className={`text-right rounded-md border p-3 transition-colors ${ps.pricing_mode === "manual" ? "border-[var(--gold)] bg-[var(--gold)]/6" : "border-ink/20 hover:border-ink/35"}`}
          >
            <div className="font-serif text-ink text-sm">دستی</div>
            <div className="text-xs text-muted-foreground mt-1">قیمت هر محصول را خودتان مستقیم وارد می‌کنید (مثل الان).</div>
          </button>
          <button
            type="button"
            onClick={() => setPs({ ...ps, pricing_mode: "formula" })}
            className={`text-right rounded-md border p-3 transition-colors ${ps.pricing_mode === "formula" ? "border-[var(--gold)] bg-[var(--gold)]/6" : "border-ink/20 hover:border-ink/35"}`}
          >
            <div className="font-serif text-ink text-sm">فرمول‌محور</div>
            <div className="text-xs text-muted-foreground mt-1">قیمت از روی هزینه‌ی عطر و شیشه و درصد سود به‌صورت خودکار محاسبه می‌شود.</div>
          </button>
        </div>

        <div className="border-t border-ink/10 pt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="نرخ دلار (تومان)">
              <Input value={ps.usd_rate_toman ?? ""} onChange={(e) => setPs({ ...ps, usd_rate_toman: e.target.value })} dir="ltr" inputMode="numeric" placeholder="اختیاری" />
              <p className="text-[11px] text-muted-foreground mt-1 font-serif">
                چون هزینه‌ی عطر به تومان وارد می‌شود، این عدد فعلاً فقط برای یادداشت شماست و روی قیمت‌ها اثر نمی‌گذارد.
              </p>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-md border border-ink/15 p-3">
            <div>
              <div className="font-serif text-ink text-sm">به‌روزرسانی خودکار نرخ دلار</div>
              <div className="text-xs text-muted-foreground mt-0.5">تلاش هفتگی برای گرفتن نرخ از یک منبع عمومی. (فعال‌سازی واقعی در مرحله‌ی بعد انجام می‌شود.)</div>
            </div>
            <Switch checked={!!ps.usd_auto_update_enabled} onCheckedChange={(v) => setPs({ ...ps, usd_auto_update_enabled: v })} />
          </div>

          {ps.usd_auto_update_enabled && (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="روز به‌روزرسانی">
                <Select value={String(ps.usd_update_day_of_week)} onValueChange={(v) => setPs({ ...ps, usd_update_day_of_week: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="سقف تغییر مجاز (٪)">
                <Input value={ps.usd_auto_update_max_change_percent ?? ""} onChange={(e) => setPs({ ...ps, usd_auto_update_max_change_percent: e.target.value })} dir="ltr" inputMode="numeric" />
                <p className="text-[11px] text-muted-foreground mt-1 font-serif">
                  اگر نرخ جدید بیشتر از این درصد با نرخ فعلی فرق داشت، خودکار اعمال نمی‌شود و فقط به شما اطلاع داده می‌شود.
                </p>
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} loadingText="ذخیره…">ذخیره</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><Label className="text-xs font-serif text-ink/80 mb-1.5 block">{label}</Label>{children}</div>);
}