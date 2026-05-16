import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState } from "@/components/ui/loading-state";
export const Route = createFileRoute("/checkout")({ component: () => (
  <PublicLayout><div className="container mx-auto px-4 py-16">
    <EmptyState title="تسویه" message="فرآیند نهایی ثبت سفارش در گام بعدی ساخته می‌شود." />
  </div></PublicLayout>
)});