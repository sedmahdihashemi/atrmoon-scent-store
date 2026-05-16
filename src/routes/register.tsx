import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { User, Store } from "lucide-react";

export const Route = createFileRoute("/register")({ component: RegisterLayout });

function RegisterLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/register/customer" || m.routeId === "/register/seller");
  if (isChild) return <Outlet />;
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="font-serif text-4xl text-ink text-center mb-3">عضویت در عطرمون</h1>
        <p className="text-center text-muted-foreground mb-12 font-serif italic">چه‌گونه می‌خواهید وارد شوید؟</p>
        <div className="grid md:grid-cols-2 gap-5">
          <Link to="/register/customer" className="paper-card rounded-md p-8 text-center hover:border-[var(--gold)] transition group">
            <User className="w-10 h-10 mx-auto text-[var(--gold)] mb-3" />
            <h2 className="font-serif text-xl text-ink mb-2">مشتری</h2>
            <p className="text-sm text-muted-foreground leading-7">برای کشف و خرید رایحه‌ها.</p>
          </Link>
          <Link to="/register/seller" className="paper-card rounded-md p-8 text-center hover:border-[var(--gold)] transition group">
            <Store className="w-10 h-10 mx-auto text-[var(--gold)] mb-3" />
            <h2 className="font-serif text-xl text-ink mb-2">فروشنده</h2>
            <p className="text-sm text-muted-foreground leading-7">برای گشودن دفتر عطرفروشی.</p>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}