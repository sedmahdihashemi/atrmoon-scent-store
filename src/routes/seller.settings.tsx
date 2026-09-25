import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

export const Route = createFileRoute("/seller/settings")({ component: SellerSettings });

function SellerSettings() {
  const { storeId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<any>({});
  const [confirmCardNumber, setConfirmCardNumber] = useState("");

  useEffect(() => {
    if (!storeId) return;
    supabase.from("stores").select("*").eq("id", storeId).single().then(({ data }) => {
      setS(data ?? {});
      setConfirmCardNumber((data as any)?.card_number ?? "");
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
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("ذخیره شد");
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

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} loadingText="ذخیره…">ذخیره</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><Label className="text-xs font-serif text-ink/80 mb-1.5 block">{label}</Label>{children}</div>);
}