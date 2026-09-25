import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatToman } from "@/lib/cart-session";
import { getReceiptSignedUrl, reviewCardTransferReceipt } from "@/lib/order-receipt-review.functions";
import { toast } from "sonner";
import { Receipt, Image as ImageIcon, Check, X } from "lucide-react";

export const Route = createFileRoute("/seller/receipts")({ component: ReceiptsPage });

function fmtTehran(d: string) {
  return new Date(d).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
}

function ReceiptsPage() {
  const { storeId } = useAuth();
  const [orders, setOrders] = useState<any[] | null>(null);

  const load = async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, total_amount, card_transfer_note, card_transfer_submitted_at, card_transfer_receipt_path")
      .eq("store_id", storeId)
      .eq("payment_method", "card_transfer")
      .eq("status", "pending_payment")
      .not("card_transfer_submitted_at", "is", null)
      .order("card_transfer_submitted_at", { ascending: true });
    setOrders(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  if (orders === null) return <LoadingState />;
  if (orders.length === 0) {
    return (
      <EmptyState
        title="مدرکی برای بررسی نیست"
        message="وقتی مشتری‌ای برای سفارش کارت‌به‌کارت مدرک بفرستد، همین‌جا نشان داده می‌شود."
        icon={<Receipt className="w-7 h-7" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl text-ink mb-2">بررسی مدرک پرداخت</h2>
      <div className="space-y-3">
        {orders.map((o) => (
          <ReceiptRow key={o.id} order={o} onDone={load} />
        ))}
      </div>
    </div>
  );
}

function ReceiptRow({ order, onDone }: { order: any; onDone: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchSignedUrl = useServerFn(getReceiptSignedUrl);
  const review = useServerFn(reviewCardTransferReceipt);

  const showReceipt = async () => {
    setLoadingImg(true);
    const res = await fetchSignedUrl({ data: { orderId: order.id } });
    setLoadingImg(false);
    if (!res.ok) {
      toast.error(res.reason === "no_receipt" ? "این سفارش فقط متن دارد، عکسی ارسال نشده" : "دریافت رسید ناموفق بود");
      return;
    }
    setSignedUrl(res.url);
  };

  const approve = async () => {
    setBusy(true);
    const res = await review({ data: { orderId: order.id, decision: "approve" } });
    setBusy(false);
    if (!res.ok) { toast.error("تأیید ناموفق بود"); return; }
    toast.success("سفارش تأیید شد");
    onDone();
  };

  const reject = async () => {
    setBusy(true);
    const res = await review({ data: { orderId: order.id, decision: "reject", reason } });
    setBusy(false);
    if (!res.ok) { toast.error("رد ناموفق بود"); return; }
    toast.success("مدرک رد شد؛ مشتری می‌تواند دوباره ارسال کند");
    onDone();
  };

  return (
    <div className="paper-card rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-serif text-ink text-sm">{order.order_number}</p>
          <p className="text-xs text-muted-foreground">{order.customer_name} · {order.customer_phone}</p>
        </div>
        <div className="text-left">
          <p className="font-serif text-[var(--gold-deep)] text-sm">{formatToman(order.total_amount)}</p>
          <p className="text-xs text-muted-foreground">ارسال مدرک: {fmtTehran(order.card_transfer_submitted_at)}</p>
        </div>
      </div>

      {order.card_transfer_note && (
        <p className="text-sm font-serif text-ink bg-ink/5 rounded-sm px-3 py-2">یادداشت مشتری: {order.card_transfer_note}</p>
      )}

      {order.card_transfer_receipt_path && (
        <div>
          {signedUrl ? (
            <img src={signedUrl} alt="رسید پرداخت" className="max-w-xs rounded-md border border-ink/10" />
          ) : (
            <Button size="sm" variant="outline" onClick={showReceipt} loading={loadingImg} loadingText="در حال دریافت…" className="gap-1.5">
              <ImageIcon className="w-4 h-4" />نمایش عکس رسید
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">لینک عکس موقت است (۵ دقیقه اعتبار دارد)، دائمی/عمومی نیست.</p>
        </div>
      )}

      {!rejecting ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={approve} loading={busy} className="gap-1.5"><Check className="w-4 h-4" />تأیید پرداخت</Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} className="gap-1.5"><X className="w-4 h-4" />رد مدرک</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs font-serif text-ink/80">دلیل رد (برای مشتری نمایش داده می‌شود)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="مثلاً: مبلغ واریزی مطابقت ندارد" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={reject} loading={busy}>ثبت رد مدرک</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>انصراف</Button>
          </div>
        </div>
      )}
    </div>
  );
}
