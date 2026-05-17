import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Moon, Sparkles, Store, BookOpen } from "lucide-react";
import heroImg from "@/assets/hero-perfume.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.18] bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[var(--paper)]/40 to-[var(--paper)]" />
        <div className="container mx-auto px-4 pt-24 pb-28 md:pt-32 md:pb-36 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-right">
            <div className="eyebrow ornament inline-flex items-center justify-center mb-6">
              <Moon className="w-3.5 h-3.5 ml-2" /> بازار رایحه و خاطره
            </div>
            <h1 className="heading-display text-6xl md:text-8xl text-ink">
              عطر<span className="text-[var(--gold-deep)]">مون</span>
            </h1>
            <div className="gold-divider w-32 my-6 mx-auto md:mr-0" />
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0 leading-loose font-serif italic">
              پاساژی آرام از عطرفروشان ایرانی؛ جایی برای پرسه، انتخاب حجم و بطری، و خریدِ بی‌شتاب.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 justify-center md:justify-start">
              <Link to="/products"><Button variant="gold" size="xl" className="font-serif">کشف رایحه‌ها</Button></Link>
              <Link to="/register/seller"><Button variant="outline" size="xl" className="font-serif">فروشنده شوید</Button></Link>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="paper-card overflow-hidden rounded-2xl">
              <img src={heroImg} alt="بطری‌های عطر در مهتاب" width={1920} height={1080} className="w-full h-[460px] object-cover" />
            </div>
            <div className="absolute -bottom-6 -right-6 paper-card rounded-xl px-5 py-3 bg-paper">
              <div className="eyebrow">از ۱۴۰۳</div>
              <div className="font-serif text-ink text-sm mt-0.5">دفتر عطرفروشان مستقل</div>
            </div>
          </div>
        </div>
        <div className="gold-divider container mx-auto" />
      </section>

      {/* Featured categories */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-10">
          <div className="eyebrow mb-3">فهرست رایحه‌ها</div>
          <h2 className="heading-display text-3xl md:text-4xl text-ink">دسته‌بندی‌ها</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {["مردانه","زنانه","یونیسکس","نیش","اقتصادی","لوکس"].map((c) => (
            <Link key={c} to="/products" className="paper-card paper-card-hover p-6 text-center group">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-[var(--gold)] opacity-60 group-hover:opacity-100 transition" />
              <div className="font-serif text-ink">{c}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Editorial */}
      <section className="container mx-auto px-4 py-20">
        <div className="paper-card p-10 md:p-16 max-w-3xl mx-auto text-center">
          <BookOpen className="w-8 h-8 mx-auto text-[var(--gold)] mb-4" />
          <p className="font-serif italic text-xl md:text-2xl text-ink leading-loose">
            «هر رایحه‌ای، خاطره‌ایست که هنوز نوشته نشده.»
          </p>
          <div className="gold-divider w-24 mx-auto my-6" />
          <p className="text-sm text-muted-foreground leading-7">
            عطرمون مجموعه‌ای از عطرفروشان مستقل ایرانی است. هر فروشنده، دفتر خودش را دارد و رایحه‌هایش را به دست خودش معرفی می‌کند. خرید در عطرمون، گفت‌وگوی مستقیم با فروشنده است؛ بی‌واسطه، آرام، و انسانی.
          </p>
        </div>
      </section>

      {/* Seller invite */}
      <section className="container mx-auto px-4 py-16">
        <div className="paper-card p-10 md:p-12 grid md:grid-cols-2 gap-8 items-center bg-gradient-paper">
          <div>
            <Store className="w-7 h-7 text-[var(--gold)] mb-3" />
            <h3 className="heading-display text-2xl md:text-3xl text-ink mb-3">دفتر خودتان را در عطرمون بگشایید</h3>
            <p className="text-muted-foreground leading-7 text-sm">
              عطرفروش هستید؟ فروشگاهتان را معرفی کنید، رایحه‌ها را با حجم و بطری دلخواه عرضه کنید، و سفارش‌ها را مستقیم دریافت کنید.
            </p>
          </div>
          <div className="md:text-left">
            <Link to="/register/seller"><Button variant="gold" size="lg" className="font-serif">ثبت‌نام فروشنده</Button></Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
