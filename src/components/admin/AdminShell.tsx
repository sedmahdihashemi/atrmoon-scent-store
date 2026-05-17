import { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Store, Users, ShoppingBag, Tag, Layers, Sparkles, Beaker, ShieldCheck } from "lucide-react";

const nav = [
  { to: "/admin", label: "نمای کلی", Icon: LayoutDashboard, exact: true },
  { to: "/admin/sellers", label: "تأیید فروشندگان", Icon: ShieldCheck },
  { to: "/admin/stores", label: "فروشگاه‌ها", Icon: Store },
  { to: "/admin/users", label: "کاربران", Icon: Users },
  { to: "/admin/orders", label: "سفارش‌ها", Icon: ShoppingBag },
  { to: "/admin/brands", label: "برندها", Icon: Tag },
  { to: "/admin/categories", label: "دسته‌ها", Icon: Layers },
  { to: "/admin/scent-notes", label: "نُت‌ها", Icon: Sparkles },
  { to: "/admin/bottle-types", label: "بطری‌ها", Icon: Beaker },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const active = (to: string, exact?: boolean) => exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--gold)]" />
          <h1 className="font-serif text-2xl md:text-3xl text-ink">پیشخوان مدیریت</h1>
        </div>
        <p className="text-muted-foreground font-serif italic text-sm mt-1">دفتر کل عطرمون.</p>
      </header>
      <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-8">
        <aside className="paper-card rounded-md p-3 h-fit md:sticky md:top-24">
          <nav className="flex md:flex-col gap-1 overflow-auto">
            {nav.map(({ to, label, Icon, exact }) => (
              <Link key={to} to={to as any} className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-serif transition shrink-0 ${active(to, exact as any) ? "bg-ink text-[var(--paper)]" : "text-ink hover:bg-ink/5"}`}>
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
