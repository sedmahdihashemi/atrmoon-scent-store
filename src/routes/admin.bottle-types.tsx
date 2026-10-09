import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RefDataManager } from "@/components/admin/RefDataManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Wine, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/bottle-types")({ component: BottleTypesPage });

function BottleTypesPage() {
  return (
    <RefDataManager
      title="بطری‌ها / حجم‌ها"
      description="انواع بطری و دکانت‌های قابل انتخاب در variantهای محصول. عکس هر شیشه برای همه‌ی فروشگاه‌ها نمایش داده می‌شود."
      table="bottle_types"
      fields={[
        { key: "name", label: "نام بطری", required: true, placeholder: "مثلاً دکانت ۵ml" },
        { key: "volume_ml", label: "حجم (ml)", type: "number", required: true },
        { key: "description", label: "توضیح" },
      ]}
      extra={(row, refresh) => <BottlePhotoCell row={row} refresh={refresh} />}
    />
  );
}

function BottlePhotoCell({ row, refresh }: { row: { id: string; image_url?: string | null; name?: string }; refresh: () => void }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const onUpload = async (file: File) => {
    if (!user) { toast.error("ابتدا وارد شوید"); return; }
    if (!file.type.startsWith("image/")) { toast.error("فقط فایل تصویری"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("حداکثر حجم ۵ مگابایت"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/bottles/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error: updErr } = await supabase.from("bottle_types").update({ image_url: data.publicUrl }).eq("id", row.id);
    setUploading(false);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success("عکس شیشه ذخیره شد");
    refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-sm bg-[var(--moon)]/40 border border-ink/10 overflow-hidden flex items-center justify-center text-ink/30 shrink-0">
        {row.image_url ? <img src={row.image_url} alt={row.name ?? ""} className="w-full h-full object-cover" /> : <Wine className="w-5 h-5" />}
      </div>
      <label className="inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-sm border border-ink/15 cursor-pointer hover:border-[var(--gold)] font-serif whitespace-nowrap">
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "در حال بارگذاری…" : "عکس"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}
