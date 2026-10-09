import { createFileRoute } from "@tanstack/react-router";
import { RefDataManager } from "@/components/admin/RefDataManager";

// Legacy global bottle list. Bottles are now store-owned (each shop defines
// its own under the seller "شیشه‌ها" tab); this remains only for any older
// data still referencing the global types.
export const Route = createFileRoute("/admin/bottle-types")({ component: () => (
  <RefDataManager
    title="بطری‌ها / حجم‌ها (قدیمی)"
    description="این فهرست قدیمی است؛ شیشه‌ها حالا در پنل هر فروشگاه تعریف می‌شوند."
    table="bottle_types"
    fields={[
      { key: "name", label: "نام بطری", required: true, placeholder: "مثلاً دکانت ۵ml" },
      { key: "volume_ml", label: "حجم (ml)", type: "number", required: true },
      { key: "description", label: "توضیح" },
    ]}
  />
) });
