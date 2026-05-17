import { createFileRoute } from "@tanstack/react-router";
import { RefDataManager } from "@/components/admin/RefDataManager";

export const Route = createFileRoute("/admin/scent-notes")({ component: () => (
  <RefDataManager
    title="نُت‌های عطر"
    description="نُت‌های پایه، میانی و رویی برای ترکیب‌بندی محصولات."
    table="scent_notes"
    fields={[
      { key: "name", label: "نام نت", required: true },
      { key: "type", label: "جایگاه", type: "select", required: true, options: [
        { value: "top", label: "رویی (Top)" },
        { value: "middle", label: "میانی (Middle)" },
        { value: "base", label: "پایه (Base)" },
        { value: "general", label: "عمومی" },
      ]},
    ]}
  />
) });
