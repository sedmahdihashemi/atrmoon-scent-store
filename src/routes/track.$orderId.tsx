import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getPublicOrderTracking } from "@/lib/order-tracking.functions";
import { getBalePayConfig } from "@/lib/bale-pay-flag.functions";
import { detectIranianBank } from "@/lib/iran-bank-cards";
import { BankIcon } from "@/lib/bank-icons";
import { PaymentMethodSwitcher } from "@/components/PaymentMethodSwitcher";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels } from "@/lib/seller-utils";
import { toast } from "sonner";
import { Copy, UploadCloud, PackageSearch } from "lucide-react";

export const Route = createFileRoute("/track/$orderId")({ component: TrackPage });

function fmtTehran(d: string) {
  return new Date(d).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
}

function TrackPage() {
  const { orderId } = Route.useParams();
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchTracking = useServerFn(getPublicOrderTracking);
  const fetchBalePayConfig = useServerFn(getBalePayConfig);

  const load = useCallback(async () => {
    const res = await fetchTracking({ data: { orderId } });
    setTracking(res);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    load();
    fetchBalePayConfig().then((c) => setBotUsername(c.botUsername)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Auto-refresh while waiting on something (payment, or seller review) —
  // same pattern as checkout.tsx's pendingPayment screen.
  useEffect(() => {
    if (!tracking?.found || tracking.status !== "pending_payment") return;
    const interval = setInterval(load, 10000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [tracking?.found, tracking?.status, load]);

  const submitReceipt = async () => {
    if (!note.trim() && !file) {
      toast.error("عکس رسید یا متن (کد پیگیری) را وارد کنید");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.set("orderId", orderId);
    if (note.trim()) fd.set("note", note.trim());
    if (file) fd.set("file", file);
    try {
      const res = await fetch("/api/public/orders/submit-receipt", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) {
        const messages: Record<string, string> = {
          not_pending: "این سفارش دیگر در انتظار پرداخت نیست.",
          expired: "مهلت این سفارش تمام شده است.",
          too_many_attempts: "تعداد تلاش‌ها بیش از حد مجاز است. با پشتیبانی تماس بگیرید.",
          rate_limited: "لطفاً کمی صبر کنید و دوباره امتحان کنید.",
          file_too_large: "حجم فایل باید کمتر از ۵ مگابایت باشد.",
          invalid_file_type: "فقط عکس JPG، PNG یا WebP قبول می‌شود.",
          empty: "عکس رسید یا متن را وارد کنید.",
        };
        toast.error(messages[json.reason] ?? "ارسال مدرک ناموفق بود.");
        return;
      }
      toast.success("مدرک شما ارسال شد. فروشنده به‌زودی بررسی می‌کند.");
      setNote("");
      setFile(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error("ارسال ناموفق بود، دوباره امتحان کنید.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <PublicLayout><LoadingState /></PublicLayout>;

  if (!tracking?.found) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16">
          <EmptyState title="سفارشی یافت نشد" message="لینک را دوباره بررسی کنید." icon={<PackageSearch className="w-8 h-8" />} />
        </div>
      </PublicLayout>
    );
  }

  const t = tracking;
  const isPending = t.status === "pending_payment";
  const payUrl = botUsername ? `https://ble.ir/${botUsername}?start=pay_${t.id}` : null;
  const formattedCard = (t.cardNumber ?? "").replace(/(\d{4})(?=\d)/g, "$1 ");
  const bank = detectIranianBank(t.cardNumber);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="paper-card rounded-md p-6 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="font-serif text-xl text-ink">{t.storeName}</h1>
              <p className="text-xs text-muted-foreground mt-1">کد سفارش: {t.orderNumber}</p>
            </div>
            <Badge variant="outline" className="font-serif">{orderStatusLabels[t.status] ?? t.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">تاریخ ثبت: {fmtTehran(t.createdAt)}</p>
        </div>

        <div className="paper-card rounded-md p-6 mb-4">
          <h2 className="font-serif text-ink mb-3">اقلام</h2>
          <div className="space-y-2">
            {t.items.map((it: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-ink/5 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="font-serif text-ink truncate">{it.productName}{it.brandName ? ` (${it.brandName})` : ""}</div>
                  <div className="text-xs text-muted-foreground">{it.bottleName} · {it.volumeMl} میلی‌لیتر × {it.quantity}</div>
                </div>
                <div className="font-serif shrink-0">{formatToman(it.totalPrice)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-serif text-ink mt-3 pt-3 border-t border-ink/10">
            <span>مبلغ کل</span>
            <span className="text-[var(--gold-deep)]">{formatToman(t.totalAmount)}</span>
          </div>
        </div>

        {isPending && t.paymentMethod === "bale" && (
          <div className="paper-card rounded-md p-6 mb-4 text-center space-y-4">
            <p className="text-sm font-serif text-ink">این سفارش هنوز پرداخت نشده است.</p>
            {payUrl && (
              <a href={payUrl} target="_blank" rel="noopener noreferrer">
                <Button className="h-11 font-serif">پرداخت با بله</Button>
              </a>
            )}
            <div className="pt-2 border-t border-ink/10">
              <PaymentMethodSwitcher orderId={t.id} currentMethod={t.paymentMethod} onSwitched={load} />
            </div>
          </div>
        )}

        {isPending && t.paymentMethod === "card_transfer" && (
          <div className="paper-card rounded-md p-6 mb-4 text-right space-y-4">
            <p className="text-sm font-serif text-ink">
              مبلغ <span className="text-[var(--gold-deep)]">{formatToman(t.totalAmount)}</span> را به شماره کارت زیر واریز کنید:
            </p>
            <div>
              <Label className="text-xs font-serif text-ink/80">شماره کارت</Label>
              <div className="flex items-center gap-2">
                <p dir="ltr" className="font-serif text-lg text-ink tracking-widest">{formattedCard}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(t.cardNumber ?? "");
                      toast.success("شماره کارت کپی شد");
                    } catch {
                      toast.error("کپی خودکار کار نکرد");
                    }
                  }}
                  className="text-ink-soft hover:text-[var(--gold-deep)] transition-colors"
                  aria-label="کپی شماره کارت"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {bank && (
                <div className="flex items-center gap-1.5 mt-1">
                  <BankIcon iconKey={bank.iconKey} size={20} />
                  <p className="text-xs text-muted-foreground font-serif">بانک: {bank.name}</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-serif text-ink/80">به نام</Label>
              <p className="font-serif text-ink">{t.cardHolderName}</p>
            </div>

            {t.cardTransferRejectionReason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm font-serif text-destructive">
                مدرک قبلی رد شد: {t.cardTransferRejectionReason}
                <br />لطفاً دوباره تلاش کنید.
              </div>
            )}
            {!t.cardTransferRejectionReason && t.cardTransferSubmittedAt && (
              <p className="text-xs text-muted-foreground font-serif">
                مدرک شما در {fmtTehran(t.cardTransferSubmittedAt)} ارسال شد و در انتظار بررسی فروشنده است.
              </p>
            )}

            <div className="border-t border-ink/10 pt-4 space-y-3">
              <p className="text-xs text-muted-foreground font-serif">بعد از واریز، عکس رسید یا کد پیگیری بانک را بفرستید (حداقل یکی اجباری):</p>
              <div>
                <Label className="text-xs font-serif text-ink/80 mb-1.5 block">عکس رسید (JPG/PNG/WebP، حداکثر ۵ مگابایت)</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm font-serif"
                />
              </div>
              <div>
                <Label className="text-xs font-serif text-ink/80 mb-1.5 block">یا کد پیگیری/توضیح</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
              <Button onClick={submitReceipt} loading={uploading} loadingText="در حال ارسال…" className="gap-1.5">
                <UploadCloud className="w-4 h-4" />ارسال مدرک پرداخت
              </Button>
            </div>

            <div className="pt-2 border-t border-ink/10">
              <PaymentMethodSwitcher orderId={t.id} currentMethod={t.paymentMethod} onSwitched={load} />
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
