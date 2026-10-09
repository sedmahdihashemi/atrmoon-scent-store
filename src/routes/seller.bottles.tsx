import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { formatToman } from "@/lib/cart-session";
import { saleFromCost } from "@/lib/pricing";
import { toast } from "sonner";
import { Wine, Upload, Trash2, Save, Plus } from "lucide-react";

export const Route = createFileRoute("/seller/bottles")({ component: BottlesPage });

type Bottle = {
  id: string;
  name: string;
  volume_ml: number;
  photo_url: string | null;
  cost_toman: number | null;
  profit_percent: number;
  is_active: boolean;
};

async function uploadBottlePhoto(userId: string, file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) { toast.error("فقط فایل تصویری"); return null; }
  if (file.size > 5 * 1024 * 1024) { toast.error("حداکثر حجم ۵ مگابایت"); return null; }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/bottles/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) { toast.error(error.message); return null; }
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function BottlesPage() {
  const { storeId, user } = useAuth();
  const [bottles, setBottles] = useState<Bottle[] | null>(null);

  const load = async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("store_bottles")
      .select("id, name, volume_ml, photo_url, cost_toman, profit_percent, is_active")
      .eq("store_id", storeId)
      .order("volume_ml");
    setBottles((data ?? []) as Bottle[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  if (!storeId || bottles === null) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl text-ink">شیشه‌ها</h2>
        <p className="text-xs text-muted-foreground font-serif mt-1">
          شیشه‌های فروشگاه خود را این‌جا یک‌بار تعریف کنید (نام، حجم، عکس، هزینه و سود). بعد در هر محصول فقط از همین لیست انتخاب می‌کنید.
        </p>
      </div>

      <AddBottle storeId={storeId} userId={user?.id ?? ""} onAdded={load} />

      {bottles.length === 0 ? (
        <EmptyState title="هنوز شیشه‌ای نساخته‌اید" message="با فرم بالا نخستین شیشه را اضافه کنید." icon={<Wine className="w-7 h-7" />} />
      ) : (
        <div className="space-y-3">
          {bottles.map((b) => <BottleRow key={b.id} bottle={b} userId={user?.id ?? ""} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function Example({ cost, profit }: { cost: string; profit: string }) {
  const c = Number(cost);
  if (cost.trim() === "" || !Number.isFinite(c) || c < 0) return null;
  const ex = saleFromCost(c, Number(profit || 0));
  return (
    <p className="text-[11px] text-muted-foreground font-serif bg-ink/5 rounded-sm px-2 py-1.5">
      مثال: قیمت فروش این شیشه <span className="text-[var(--gold-deep)]">{formatToman(ex.sale)}</span> و سود شما <span className="text-[var(--gold-deep)]">{formatToman(ex.profit)}</span> می‌شود.
    </p>
  );
}

function AddBottle({ storeId, userId, onAdded }: { storeId: string; userId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [volume, setVolume] = useState("");
  const [cost, setCost] = useState("");
  const [profit, setProfit] = useState("0");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setVolume(""); setCost(""); setProfit("0"); setPhotoUrl(null); };

  const add = async () => {
    if (!name.trim()) { toast.error("نام شیشه را وارد کنید"); return; }
    const vol = Number(volume);
    if (!Number.isInteger(vol) || vol <= 0) { toast.error("حجم باید یک عدد صحیح مثبت باشد"); return; }
    const costNum = cost.trim() === "" ? null : Number(cost);
    if (costNum != null && (!Number.isFinite(costNum) || costNum < 0)) { toast.error("هزینه معتبر نیست"); return; }
    const profitNum = Number(profit || 0);
    if (!Number.isFinite(profitNum) || profitNum < 0) { toast.error("درصد سود معتبر نیست"); return; }
    setSaving(true);
    const { error } = await supabase.from("store_bottles").insert({
      store_id: storeId, name: name.trim(), volume_ml: vol, photo_url: photoUrl,
      cost_toman: costNum, profit_percent: profitNum, is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("شیشه اضافه شد");
    reset();
    onAdded();
  };

  return (
    <div className="paper-card rounded-md p-4 space-y-3">
      <div className="text-sm font-serif text-ink flex items-center gap-1"><Plus className="w-4 h-4" /> افزودن شیشه‌ی جدید</div>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-sm bg-[var(--moon)]/40 border border-ink/10 overflow-hidden flex items-center justify-center text-ink/30">
            {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <Wine className="w-6 h-6" />}
          </div>
          <label className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-sm border border-ink/15 cursor-pointer hover:border-[var(--gold)] font-serif">
            <Upload className="w-3 h-3" />{uploading ? "…" : "عکس"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={async (e) => { const f = e.target.files?.[0]; if (f && userId) { setUploading(true); const u = await uploadBottlePhoto(userId, f); if (u) setPhotoUrl(u); setUploading(false); } e.target.value = ""; }} />
          </label>
        </div>
        <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">نام شیشه</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً دکانت شیشه‌ای ۵ml" /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">حجم (میلی‌لیتر)</Label><Input dir="ltr" inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">هزینه‌ی خرید (تومان)</Label><Input dir="ltr" inputMode="numeric" placeholder="اختیاری" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">درصد سود (٪)</Label><Input dir="ltr" inputMode="numeric" value={profit} onChange={(e) => setProfit(e.target.value)} /></div>
        </div>
      </div>
      <Example cost={cost} profit={profit} />
      <div className="flex justify-end">
        <Button onClick={add} loading={saving} loadingText="…" className="gap-1"><Plus className="w-4 h-4" />افزودن شیشه</Button>
      </div>
    </div>
  );
}

function BottleRow({ bottle, userId, onChanged }: { bottle: Bottle; userId: string; onChanged: () => void }) {
  const [name, setName] = useState(bottle.name);
  const [volume, setVolume] = useState(String(bottle.volume_ml));
  const [cost, setCost] = useState(bottle.cost_toman == null ? "" : String(bottle.cost_toman));
  const [profit, setProfit] = useState(String(bottle.profit_percent));
  const [photoUrl, setPhotoUrl] = useState<string | null>(bottle.photo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("نام شیشه را وارد کنید"); return; }
    const vol = Number(volume);
    if (!Number.isInteger(vol) || vol <= 0) { toast.error("حجم معتبر نیست"); return; }
    const costNum = cost.trim() === "" ? null : Number(cost);
    if (costNum != null && (!Number.isFinite(costNum) || costNum < 0)) { toast.error("هزینه معتبر نیست"); return; }
    const profitNum = Number(profit || 0);
    if (!Number.isFinite(profitNum) || profitNum < 0) { toast.error("درصد سود معتبر نیست"); return; }
    setSaving(true);
    const { error } = await supabase.from("store_bottles").update({
      name: name.trim(), volume_ml: vol, photo_url: photoUrl, cost_toman: costNum, profit_percent: profitNum,
    }).eq("id", bottle.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ذخیره شد");
    onChanged();
  };

  const toggleActive = async (v: boolean) => {
    const { error } = await supabase.from("store_bottles").update({ is_active: v }).eq("id", bottle.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  const remove = async () => {
    if (!confirm("این شیشه حذف شود؟")) return;
    const { error } = await supabase.from("store_bottles").delete().eq("id", bottle.id);
    if (error) {
      // FK is ON DELETE RESTRICT — a bottle used by a product can't be deleted.
      toast.error("این شیشه در یک محصول استفاده شده و قابل حذف نیست. می‌توانید غیرفعالش کنید.");
      return;
    }
    toast.success("حذف شد");
    onChanged();
  };

  return (
    <div className="paper-card rounded-md p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-sm bg-[var(--moon)]/40 border border-ink/10 overflow-hidden flex items-center justify-center text-ink/30">
            {photoUrl ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" /> : <Wine className="w-6 h-6" />}
          </div>
          <label className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-sm border border-ink/15 cursor-pointer hover:border-[var(--gold)] font-serif">
            <Upload className="w-3 h-3" />{uploading ? "…" : "عکس"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={async (e) => { const f = e.target.files?.[0]; if (f && userId) { setUploading(true); const u = await uploadBottlePhoto(userId, f); if (u) setPhotoUrl(u); setUploading(false); } e.target.value = ""; }} />
          </label>
        </div>
        <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">نام شیشه</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">حجم (میلی‌لیتر)</Label><Input dir="ltr" inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">هزینه‌ی خرید (تومان)</Label><Input dir="ltr" inputMode="numeric" placeholder="اختیاری" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <div><Label className="text-xs font-serif text-ink/80 mb-1 block">درصد سود (٪)</Label><Input dir="ltr" inputMode="numeric" value={profit} onChange={(e) => setProfit(e.target.value)} /></div>
        </div>
      </div>
      <Example cost={cost} profit={profit} />
      <div className="flex items-center justify-between flex-wrap gap-2 border-t border-ink/10 pt-3">
        <label className="flex items-center gap-2 text-xs font-serif text-ink/80">
          <Switch checked={bottle.is_active} onCheckedChange={toggleActive} />
          {bottle.is_active ? "فعال (قابل انتخاب در محصول)" : "غیرفعال"}
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={remove} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
          <Button size="sm" onClick={save} loading={saving} loadingText="…" className="gap-1"><Save className="w-4 h-4" />ذخیره</Button>
        </div>
      </div>
    </div>
  );
}
