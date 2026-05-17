import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-mark.png";
import { Flourish } from "@/components/visual/PersianOrnament";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-ink/10 bg-paper-deep/40 paper-grain">
      <div className="container mx-auto px-4 pt-16 pb-10">
        <Flourish className="w-full max-w-md mx-auto text-ink/30 mb-12" />
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoMark} alt="عطرمون" width={36} height={36} className="w-9 h-9" />
              <div className="flex flex-col leading-none">
                <span className="font-serif text-2xl text-ink">عطرمون</span>
                <span className="eyebrow text-[0.55rem] mt-1 tracking-[0.32em]">Atrmoon</span>
              </div>
            </Link>
            <p className="mt-6 text-sm leading-[2.1] text-ink-soft max-w-md font-serif italic">
              بازاری از عطرفروشان ایرانی. شبیه پرسه در بازاری قدیمی که هر مغازه‌اش رایحه‌ای دارد و هر رایحه، خاطره‌ای.
            </p>
          </div>
          <div className="md:col-span-3">
            <h4 className="eyebrow mb-5">پرسه</h4>
            <ul className="space-y-3 text-sm font-serif text-ink-soft">
              <li><Link to="/products" className="hover:text-gold-deep transition-colors duration-700">رایحه‌ها</Link></li>
              <li><Link to="/stores" className="hover:text-gold-deep transition-colors duration-700">عطرفروشی‌ها</Link></li>
              <li><Link to="/search" className="hover:text-gold-deep transition-colors duration-700">جستجوی آرام</Link></li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <h4 className="eyebrow mb-5">عطاری عطرمون</h4>
            <ul className="space-y-3 text-sm font-serif text-ink-soft">
              <li><Link to="/about" className="hover:text-gold-deep transition-colors duration-700">یادداشت‌ها</Link></li>
              <li><Link to="/register/seller" className="hover:text-gold-deep transition-colors duration-700">گشودنِ عطاریی از آنِ تو</Link></li>
              <li><Link to="/contact" className="hover:text-gold-deep transition-colors duration-700">گفت‌وگو</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="container mx-auto px-4 py-5 text-xs text-ink-soft font-serif italic text-center">
          همه‌چیز در عطرمون با حوصله ساخته می‌شود · © ۱۴۰۳
        </div>
      </div>
    </footer>
  );
}