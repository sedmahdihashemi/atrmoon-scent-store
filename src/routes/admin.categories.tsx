import { createFileRoute } from "@tanstack/react-router";
import { RefDataManager } from "@/components/admin/RefDataManager";

export const Route = createFileRoute("/admin/categories")({ component: () => (
  <RefDataManager
    title="دسته‌بندی‌ها"
    description="دسته‌های اصلی عطرها (مردانه، زنانه، یونیسکس و...)."
    table="categories"
    autoSlugFrom="name"
    fields={[
      { key: "name", label: "نام دسته", required: true },
      { key: "slug", label: "اسلاگ (اختیاری)" },
      { key: "description", label: "توضیح کوتاه" },
    ]}
  />
) });
