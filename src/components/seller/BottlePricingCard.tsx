import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatToman } from "@/lib/cart-session";
import { saleFromCost } from "@/lib/pricing";
import { toast } from "sonner";
import { Wine } from "lucide-react";

type Bottle = { id: string; name: string; volume_ml: number; image_url: string | null };
type Entry = { cost: string; profit: string };

// Per-store bottle cost/profit, used by the formula to price the bottle part.
// Bottle photos are global and admin-managed (bottle_types.image_url); the
// seller only sets cost/profit here and sees the photo read-only.
export function BottlePricingCard({ storeId }: { storeId: string }) {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      supabase.from("bottle_types").select("id, name, volume_ml, image_url").order("volume_ml"),
      supabase.from("store_bottle_pricing").select("bottle_type_id, cost_toman, profit_percent").eq("store_id", storeId),
    ]).then(([btRes, sbpRes]) => {
      const bt = (btRes.data ?? []) as Bottle[];
      setBottles(bt);
      const map: Record<string, Entry> = {};
      for (const b of bt) map[b.id] = { cost: "", profit: "0" };
      for (const r of (sbpRes.data ?? []) as any[]) {
        map[r.bottle_type_id] = { cost: r.cost_toman == null ? "" : String(r.cost_toman), profit: String(r.profit_percent ?? 0) };
      }
      setEntries(map);
      setLoading(false);
    });
  }, [storeId]);

  const setEntry = (id: string, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const save = async () => {
    const rows: { store_id: string; bottle_type_id: string; cost_toman: number; profit_percent: number }[] = [];
    for (const b of bottles) {
      const e = entries[b.id];
      if (!e || e.cost.trim() === "") continue; // blank = not priced, skip
      const cost = Number(e.cost);
      const profit = Number(e.profit || 0);
      if (!Number.isFinite(cost) || cost < 0) { toast.error(`هزینه‌ی «${b.name}» معتبر نیست`); return; }
      if (!Number.isFinite(profit) || profit < 0) { toast.error(`درصد سود «${b.name}» معتبر نیست`); return; }
      rows.push({ store_id: storeId, bottle_type_id: b.id, cost_toman: cost, profit_percent: profit });
    }
    if (rows.length === 0) { toast.error("حداقل برای یک شیشه هزینه وارد کنید"); return; }
    setSaving(true);
    const { error } = await supabase.from("store_bottle_pricing").upsert(rows, { onConflict: "store_id,bottle_type_id" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("قیمت شیشه‌ها ذخیره شد");
  };

  if (loading) return null;

  return (
    <div className="paper-card rounded-md p-5 space-y-4">
      <div>
        <h3 className="font-serif text-base text-ink mb-1">قیمت شیشه‌ها</h3>
        <p className="text-xs text-muted-foreground font-serif">
          هزینه‌ی خرید و درصد سود هر شیشه. در حالت «فرمول‌محور» برای محاسبه‌ی بخشِ شیشه‌ی قیمت استفاده می‌شود. شیشه‌هایی که خالی بگذارید قیمت‌گذاری نمی‌شوند.
        </p>
      </div>

      {bottles.length === 0 && <p className="text-sm text-muted-foreground font-serif">هنوز نوع شیشه‌ای توسط مدیر ثبت نشده.</p>}

      <div className="space-y-3">
        {bottles.map((b) => {
          const e = entries[b.id] ?? { cost: "", profit: "0" };
          const costNum = Number(e.cost);
          const showExample = e.cost.trim() !== "" && Number.isFinite(costNum) && costNum >= 0;
          const ex = showExample ? saleFromCost(costNum, Number(e.profit || 0)) : null;
          return (
            <div key={b.id} className="rounded-md border border-ink/10 p-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-sm bg-[var(--moon)]/40 border border-ink/10 shrink-0 overflow-hidden flex items-center justify-center text-ink/30">
                  {b.image_url ? <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" /> : <Wine className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-ink text-sm">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.volume_ml.toLocaleString("fa-IR")} میلی‌لیتر</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs font-serif text-ink/80 mb-1 block">هزینه‌ی خرید شیشه (تومان)</Label>
                  <Input dir="ltr" inputMode="numeric" placeholder="اختیاری" value={e.cost} onChange={(ev) => setEntry(b.id, { cost: ev.target.value })} />
                </div>
                <div>
                  <Label className="text-xs font-serif text-ink/80 mb-1 block">درصد سود شیشه (٪)</Label>
                  <Input dir="ltr" inputMode="numeric" value={e.profit} onChange={(ev) => setEntry(b.id, { profit: ev.target.value })} />
                </div>
              </div>
              {ex && (
                <p className="text-[11px] text-muted-foreground font-serif mt-2 bg-ink/5 rounded-sm px-2 py-1.5">
                  مثال: با این هزینه و سود، قیمت فروش شیشه <span className="text-[var(--gold-deep)]">{formatToman(ex.sale)}</span> و سود شما <span className="text-[var(--gold-deep)]">{formatToman(ex.profit)}</span> می‌شود.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {bottles.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} loadingText="ذخیره…">ذخیره قیمت شیشه‌ها</Button>
        </div>
      )}
    </div>
  );
}
