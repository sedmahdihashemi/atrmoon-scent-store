import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState } from "@/components/ui/loading-state";
export const Route = createFileRoute("/products/$slug")({ component: () => (
  <PublicLayout>
    <div className="container mx-auto px-4 py-12">
      <EmptyState title="صفحه‌ی این رایحه به‌زودی" message="جزئیات کامل این عطر، انتخاب حجم و بطری در نسخه بعدی فعال می‌شود." />
    </div>
  </PublicLayout>
)});