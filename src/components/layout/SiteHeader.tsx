import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Search, ShoppingBag, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import logoMark from "@/assets/logo-mark.png";

export function SiteHeader() {
  const { user, role, profile, signOut, storeStatus } = useAuth();
  const { count } = useCart();

  const dashLink =
    role === "super_admin" ? "/admin"
    : role === "seller" ? (storeStatus === "approved" ? "/seller" : "/seller/pending")
    : "/account";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--paper)]/80 border-b border-ink/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src={logoMark} alt="عطرمون" width={32} height={32} className="w-8 h-8 group-hover:rotate-[8deg] transition-transform duration-300" />
          <span className="font-serif text-2xl text-ink tracking-tight">عطرمون</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-ink/80">
          <Link to="/products" className="hover:text-[var(--gold)] transition">رایحه‌ها</Link>
          <Link to="/stores" className="hover:text-[var(--gold)] transition">عطرفروشی‌ها</Link>
          <Link to="/about" className="hover:text-[var(--gold)] transition">درباره</Link>
          <Link to="/contact" className="hover:text-[var(--gold)] transition">گفت‌وگو</Link>
        </nav>

        <div className="flex items-center gap-1">
          <Link to="/search" aria-label="جستجو" className="p-2 rounded-md hover:bg-ink/5">
            <Search className="w-5 h-5" />
          </Link>
          <Link to="/cart" aria-label="سبد" className="relative p-2 rounded-md hover:bg-ink/5">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--gold)] text-[10px] font-serif text-[var(--paper)] flex items-center justify-center">
                {count.toLocaleString("fa-IR")}
              </span>
            )}
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-md hover:bg-ink/5">
                  <User className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel className="font-serif">{profile?.full_name || "حساب من"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={dashLink}><LayoutDashboard className="w-4 h-4 ml-2" /> پیشخوان</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="w-4 h-4 ml-2" /> خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm" className="font-serif">ورود</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}