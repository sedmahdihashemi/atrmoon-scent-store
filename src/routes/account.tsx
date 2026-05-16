import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { User, MapPin, Package, Heart, Bell } from "lucide-react";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  return (
    <PublicLayout>
      <RoleGuard allow={["customer","seller","super_admin"]}>
        <AccountInner />
      </RoleGuard>
    </PublicLayout>
  );
}

function AccountInner() {
  const { profile } = useAuth();
  const items = [
    { to: "/account", label: "پروفایل", Icon: User },
    { to: "/account", label: "آدرس‌ها", Icon: MapPin },
    { to: "/account", label: "سفارش‌ها", Icon: Package },
    { to: "/account", label: "علاقه‌مندی‌ها", Icon: Heart },
    { to: "/account", label: "اعلان‌ها", Icon: Bell },
  ];
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="font-serif text-3xl text-ink">سلام {profile?.full_name || ""}</h1>
      <p className="text-muted-foreground font-serif italic mt-1">به دفتر خصوصی‌تان در عطرمون خوش‌آمدید.</p>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {items.map(({ to, label, Icon }) => (
          <Link key={label} to={to} className="paper-card rounded-md p-6 hover:border-[var(--gold)] transition">
            <Icon className="w-6 h-6 text-[var(--gold)] mb-2" />
            <div className="font-serif text-ink">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}