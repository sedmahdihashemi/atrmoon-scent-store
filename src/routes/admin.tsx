import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Users, Store, Package, ShoppingBag, Tag, Layers, Sparkles, Beaker, Mail, ScrollText, Settings } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  return (
    <PublicLayout>
      <RoleGuard allow={["super_admin"]}>
        <AdminDashboard />
      </RoleGuard>
    </PublicLayout>
  );
}

function AdminDashboard() {
  const sections = [
    { label: "کاربران", Icon: Users },
    { label: "تأیید فروشندگان", Icon: Store },
    { label: "فروشگاه‌ها", Icon: Store },
    { label: "محصولات", Icon: Package },
    { label: "سفارش‌ها", Icon: ShoppingBag },
    { label: "برندها", Icon: Tag },
    { label: "دسته‌ها", Icon: Layers },
    { label: "نُت‌های عطر", Icon: Sparkles },
    { label: "بطری‌ها", Icon: Beaker },
    { label: "لاگ ایمیل", Icon: Mail },
    { label: "لاگ ممیزی", Icon: ScrollText },
    { label: "تنظیمات", Icon: Settings },
  ];
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="font-serif text-3xl text-ink">پیشخوان مدیریت</h1>
      <p className="text-muted-foreground font-serif italic mt-1">دفتر کل عطرمون.</p>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
        {sections.map(({ label, Icon }) => (
          <div key={label} className="paper-card rounded-md p-6">
            <Icon className="w-6 h-6 text-[var(--gold)] mb-2" />
            <div className="font-serif text-ink">{label}</div>
            <p className="text-xs text-muted-foreground mt-2">به‌زودی</p>
          </div>
        ))}
      </div>
    </div>
  );
}