import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listStoreWholesaleRequests, reviewWholesaleMembership } from "@/lib/wholesale.functions";
import { toast } from "sonner";
import { BadgePercent, Check, X, Clock } from "lucide-react";

export const Route = createFileRoute("/seller/wholesale")({ component: WholesalePage });

function fmtTehran(d: string | null) {
  return d ? new Date(d).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }) : "—";
}

type Req = {
  id: string;
  status: "pending" | "approved" | "rejected";
  oilProfitPercent: number | null;
  requestedAt: string;
  reviewedAt: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
};

function WholesalePage() {
  const { storeId } = useAuth();
  const [data, setData] = useState<{ requests: Req[]; storeDefault: number | null } | null>(null);
  const list = useServerFn(listStoreWholesaleRequests);

  const load = useCallback(async () => {
    if (!storeId) return;
    const res = await list({ data: { storeId } });
    if (!res.ok) { toast.error("بارگذاری فهرست ناموفق بود"); return; }
    setData({ requests: res.requests as Req[], storeDefault: res.storeDefaultOilProfit });
  }, [storeId, list]);

  useEffect(() => { load(); }, [load]);

  if (data === null) return <LoadingState />;

  const pending = data.requests.filter((r) => r.status === "pending");
  const approved = data.requests.filter((r) => r.status === "approved");
  const rejected = data.requests.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl text-ink flex items-center gap-2">
          <BadgePercent className="w-5 h-5 text-[var(--gold)]" /> خریداران عمده
        </h2>
        <p className="text-xs text-muted-foreground font-serif mt-1">
          قیمت‌های عمده فقط برای خریدارانی نمایش داده می‌شود که اینجا تأیید کنید.
          {data.storeDefault != null
            ? ` نرخ پیش‌فرض فروشگاه: ${data.storeDefault}٪ سود عطر.`
            : " هنوز نرخ عمده‌ی پیش‌فرض تنظیم نکرده‌اید (در «تنظیمات فروشگاه»)."}
        </p>
      </div>

      {data.requests.length === 0 ? (
        <EmptyState
          title="هنوز درخواستی نیست"
          message="وقتی مشتری‌ای از صفحه‌ی فروشگاه درخواست خرید عمده بدهد، همین‌جا نشان داده می‌شود."
          icon={<BadgePercent className="w-7 h-7" />}
        />
      ) : (
        <>
          {pending.length > 0 && (
            <Section title="در انتظار بررسی" icon={<Clock className="w-4 h-4" />}>
              {pending.map((r) => (
                <RequestRow key={r.id} r={r} storeDefault={data.storeDefault} onDone={load} />
              ))}
            </Section>
          )}
          {approved.length > 0 && (
            <Section title="تأییدشده" icon={<Check className="w-4 h-4" />}>
              {approved.map((r) => (
                <RequestRow key={r.id} r={r} storeDefault={data.storeDefault} onDone={load} />
              ))}
            </Section>
          )}
          {rejected.length > 0 && (
            <Section title="ردشده" icon={<X className="w-4 h-4" />}>
              {rejected.map((r) => (
                <RequestRow key={r.id} r={r} storeDefault={data.storeDefault} onDone={load} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-serif text-sm text-ink/80 flex items-center gap-1.5">{icon} {title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RequestRow({ r, storeDefault, onDone }: { r: Req; storeDefault: number | null; onDone: () => void }) {
  const [rate, setRate] = useState<string>(r.oilProfitPercent == null ? "" : String(r.oilProfitPercent));
  const [busy, setBusy] = useState(false);
  const review = useServerFn(reviewWholesaleMembership);

  const effectiveLabel =
    r.oilProfitPercent != null
      ? `${r.oilProfitPercent}٪ (اختصاصی)`
      : storeDefault != null
        ? `پیش‌فرض فروشگاه: ${storeDefault}٪`
        : "نرخ عمده هنوز تنظیم نشده";

  const act = async (decision: "approve" | "reject") => {
    setBusy(true);
    const trimmed = rate.trim();
    const n = trimmed === "" ? undefined : Number(trimmed);
    if (decision === "approve" && n !== undefined && (!Number.isFinite(n) || n < 0)) {
      setBusy(false);
      toast.error("درصد سود باید عدد معتبر (۰ یا بیشتر) باشد");
      return;
    }
    const res = await review({
      data: {
        membershipId: r.id,
        decision,
        ...(decision === "approve" ? { oilProfitPercent: n === undefined ? null : n } : {}),
      },
    });
    setBusy(false);
    if (!res.ok) { toast.error("عملیات ناموفق بود"); return; }
    toast.success(decision === "approve" ? "تأیید شد" : "رد شد");
    onDone();
  };

  return (
    <div className="paper-card rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <p className="font-serif text-ink text-sm">{r.customerName}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{r.customerEmail || "—"}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{r.customerPhone || "—"}</p>
        </div>
        <div className="text-left">
          <p className="text-[11px] text-muted-foreground">درخواست: {fmtTehran(r.requestedAt)}</p>
          {r.status === "approved" && (
            <p className="text-[11px] text-[var(--gold-deep)] font-serif mt-0.5">{effectiveLabel}</p>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-40">
          <Label className="text-[11px] font-serif text-ink/70 mb-1 block">
            درصد سود عمده {storeDefault != null ? "(خالی = پیش‌فرض)" : "(خالی = قیمت خرده)"}
          </Label>
          <Input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            dir="ltr"
            inputMode="numeric"
            placeholder={storeDefault != null ? String(storeDefault) : "مثلاً ۲۰"}
          />
        </div>
        {r.status !== "approved" ? (
          <>
            <Button size="sm" onClick={() => act("approve")} loading={busy} className="gap-1.5">
              <Check className="w-4 h-4" /> تأیید
            </Button>
            {r.status === "pending" && (
              <Button size="sm" variant="outline" onClick={() => act("reject")} loading={busy} className="gap-1.5">
                <X className="w-4 h-4" /> رد
              </Button>
            )}
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => act("approve")} loading={busy}>
              ذخیره‌ی نرخ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act("reject")} loading={busy} className="gap-1.5 text-destructive">
              <X className="w-4 h-4" /> لغو دسترسی
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
