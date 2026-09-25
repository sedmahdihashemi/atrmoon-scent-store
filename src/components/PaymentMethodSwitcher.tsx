import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { switchOrderPaymentMethod } from "@/lib/order-payment-method.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LABELS: Record<string, string> = {
  cod: "نقدی / تماس",
  bale: "بله",
  card_transfer: "کارت به کارت",
};

const ERROR_MESSAGES: Record<string, string> = {
  not_pending: "این سفارش دیگر در انتظار پرداخت نیست.",
  bale_disabled: "پرداخت با بله فعلاً فعال نیست.",
  no_card: "این فروشگاه شماره کارت ثبت نکرده است.",
  not_found: "سفارش پیدا نشد.",
  error: "خطایی رخ داد.",
};

// Doesn't pre-check whether Bale/card-transfer are actually available for
// this order's store — always offers all three, and relies on the server
// (switchOrderPaymentMethod) to reject with a clear reason if not. Keeps
// this component simple; the failure case is just a toast, not broken UI.
export function PaymentMethodSwitcher({
  orderId,
  currentMethod,
  onSwitched,
}: {
  orderId: string;
  currentMethod: string;
  onSwitched: (newMethod: "cod" | "bale" | "card_transfer") => void;
}) {
  const [busy, setBusy] = useState(false);
  const switchMethod = useServerFn(switchOrderPaymentMethod);

  const options = (["cod", "bale", "card_transfer"] as const).filter((m) => m !== currentMethod);

  const doSwitch = async (method: "cod" | "bale" | "card_transfer") => {
    setBusy(true);
    const res = await switchMethod({ data: { orderId, method } });
    setBusy(false);
    if (!res.ok) {
      toast.error(ERROR_MESSAGES[res.reason as string] ?? "خطایی رخ داد.");
      return;
    }
    toast.success("روش پرداخت تغییر کرد");
    onSwitched(method);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground font-serif">تغییر روش پرداخت به:</span>
      {options.map((m) => (
        <Button key={m} size="sm" variant="outline" disabled={busy} onClick={() => doSwitch(m)}>
          {LABELS[m]}
        </Button>
      ))}
    </div>
  );
}
