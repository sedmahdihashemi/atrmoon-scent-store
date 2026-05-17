import { createFileRoute } from "@tanstack/react-router";
import { RefDataManager } from "@/components/admin/RefDataManager";

export const Route = createFileRoute("/admin/bottle-types")({ component: () => (
  <RefDataManager
    title="بطری‌ها / حجم‌ها"
    description="انواع بطری و دکانت‌های قابل انتخاب در variantهای محصول."
    table="bottle_types"
    fields={[
      { key: "name", label: "نام بطری", required: true, placeholder: "مثلاً دکانت ۵ml" },
      { key: "volume_ml", label: "حجم (ml)", type: "number", required: true },
      { key: "description", label: "توضیح" },
    ]}
  />
) });
