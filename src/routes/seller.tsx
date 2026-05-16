import { createFileRoute, Outlet, useMatches, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { Package, ShoppingBag, Store, Bell, Settings } from "lucide-react";

export const Route = createFileRoute("/seller")({ component: SellerPage });

function SellerPage() {
  const matches = useMatches();
  if (matches.some((m) => m.routeId === "/seller/pending")) return <Outlet />;
  return (
    <PublicLayout>
      <RoleGuard allow={["seller"]} requireApprovedStore>
        <SellerDashboard />
      </RoleGuard>
    </PublicLayout>
  );
}

function SellerDashboard() {
  const { profile } = useAuth();
  const items = [
    { label: "فروشگاه", Icon: Store },
    { label: "محصولات", Icon: Package },
    { label: "سفارش‌ها", Icon: ShoppingBag },
    { label: "اعلان‌ها", Icon: Bell },
    { label: "تنظیمات", Icon: Settings },
  ];
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="font-serif text-3xl text-ink">دفتر فروشنده</h1>
      <p className="text-muted-foreground font-serif italic mt-1">خوش‌آمدید {profile?.full_name}.</p>
      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
        {items.map(({ label, Icon }) => (
          <div key={label} className="paper-card rounded-md p-6 text-center">
            <Icon className="w-6 h-6 text-[var(--gold)] mb-2 mx-auto" />
            <div className="font-serif text-ink">{label}</div>
            <p className="text-xs text-muted-foreground mt-2">به‌زودی</p>
          </div>
        ))}
      </div>
    </div>
  );
}