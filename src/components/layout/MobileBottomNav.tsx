import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, User } from "lucide-react";

const items = [
  { to: "/", label: "خانه", Icon: Home },
  { to: "/search", label: "جستجو", Icon: Search },
  { to: "/cart", label: "سبد", Icon: ShoppingBag },
  { to: "/account", label: "من", Icon: User },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)]/95 backdrop-blur border-t border-ink/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <li key={to}>
              <Link to={to} className={`flex flex-col items-center gap-1 py-2.5 text-xs ${active ? "text-[var(--gold)]" : "text-ink/70"}`}>
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}