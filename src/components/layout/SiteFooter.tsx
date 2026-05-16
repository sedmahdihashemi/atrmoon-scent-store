import { Link } from "@tanstack/react-router";
import { Moon } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-[var(--paper)]/60">
      <div className="container mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Moon className="w-6 h-6 text-[var(--gold)]" />
            <span className="font-serif text-2xl">عطرمون</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-foreground max-w-md">
            بازاری از عطرفروشان ایرانی. شبیه پرسه در پاساژی قدیمی که هر مغازه‌اش رایحه‌ای دارد و هر رایحه، خاطره‌ای.
          </p>
        </div>
        <div>
          <h4 className="font-serif text-ink mb-3">جستن</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/products" className="hover:text-[var(--gold)]">همه رایحه‌ها</Link></li>
            <li><Link to="/stores" className="hover:text-[var(--gold)]">عطرفروشی‌ها</Link></li>
            <li><Link to="/search" className="hover:text-[var(--gold)]">جستجو</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-ink mb-3">عطرمون</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-[var(--gold)]">درباره ما</Link></li>
            <li><Link to="/register/seller" className="hover:text-[var(--gold)]">فروشنده شوید</Link></li>
            <li><Link to="/contact" className="hover:text-[var(--gold)]">گفت‌وگو</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="container mx-auto px-4 py-4 text-xs text-muted-foreground font-serif italic text-center">
          همه‌چیز در عطرمون با حوصله ساخته می‌شود.
        </div>
      </div>
    </footer>
  );
}