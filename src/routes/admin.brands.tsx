import { createFileRoute } from "@tanstack/react-router";
import { RefDataManager } from "@/components/admin/RefDataManager";

export const Route = createFileRoute("/admin/brands")({ component: () => (
  <RefDataManager
    title="برندها"
    description="فهرست برندهای قابل انتخاب در محصولات."
    table="brands"
    autoSlugFrom="name"
    fields={[
      { key: "name", label: "نام برند", required: true },
      { key: "slug", label: "اسلاگ (اختیاری)" },
    ]}
  />
) });
