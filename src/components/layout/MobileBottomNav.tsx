import { Link, useLocation } from "@tanstack/react-router";
import { useCart } from "@/hooks/useCart";
import { Home, Search, ShoppingBag, User } from "lucide-react";

const items = [
  { to: "/", label: "خانه", Icon: Home },
  { to: "/search", label: "جستجو", Icon: Search },
  { to: "/cart", label: "سبد", Icon: ShoppingBag },
  { to: "/account", label: "من", Icon: User },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { count } = useCart();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)]/95 backdrop-blur border-t border-ink/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <li key={to}>
              <Link to={to} className={`flex flex-col items-center gap-1 py-2.5 text-xs ${active ? "text-[var(--gold)]" : "text-ink/70"}`}>
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {to === "/cart" && count > 0 && (
                    <span className="absolute -top-1.5 -left-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--tile)] text-[10px] font-serif text-[var(--paper)] flex items-center justify-center">
                      {count.toLocaleString("fa-IR")}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}