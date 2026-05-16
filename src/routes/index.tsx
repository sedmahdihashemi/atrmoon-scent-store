import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Moon, Sparkles, Store, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[var(--gold)] font-serif mb-6">
            <Moon className="w-4 h-4" /> بازار رایحه و خاطره
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-ink leading-tight">
            عطرمون
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-loose font-serif italic">
            پاساژی آرام از عطرفروشان ایرانی؛ جایی برای پرسه، انتخاب حجم و بطری، و خریدِ بی‌شتاب.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link to="/products"><Button size="lg" className="font-serif">کشف رایحه‌ها</Button></Link>
            <Link to="/register/seller"><Button variant="outline" size="lg" className="font-serif">فروشنده شوید</Button></Link>
          </div>
        </div>
        <div className="ink-divider container mx-auto" />
      </section>

      {/* Featured categories */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="font-serif text-3xl text-ink mb-8 text-center">دسته‌بندی‌ها</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {["مردانه","زنانه","یونیسکس","نیش","اقتصادی","لوکس"].map((c) => (
            <Link key={c} to="/products" className="paper-card rounded-md p-6 text-center hover:border-[var(--gold)] transition group">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-[var(--gold)] opacity-60 group-hover:opacity-100 transition" />
              <div className="font-serif text-ink">{c}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Editorial */}
      <section className="container mx-auto px-4 py-20">
        <div className="paper-card rounded-md p-10 md:p-16 max-w-3xl mx-auto text-center">
          <BookOpen className="w-8 h-8 mx-auto text-[var(--gold)] mb-4" />
          <p className="font-serif italic text-xl md:text-2xl text-ink leading-loose">
            «هر رایحه‌ای، خاطره‌ایست که هنوز نوشته نشده.»
          </p>
          <p className="mt-6 text-sm text-muted-foreground leading-7">
            عطرمون مجموعه‌ای از عطرفروشان مستقل ایرانی است. هر فروشنده، دفتر خودش را دارد و رایحه‌هایش را به دست خودش معرفی می‌کند. خرید در عطرمون، گفت‌وگوی مستقیم با فروشنده است؛ بی‌واسطه، آرام، و انسانی.
          </p>
        </div>
      </section>

      {/* Seller invite */}
      <section className="container mx-auto px-4 py-16">
        <div className="paper-card rounded-md p-10 md:p-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <Store className="w-7 h-7 text-[var(--gold)] mb-3" />
            <h3 className="font-serif text-2xl md:text-3xl text-ink mb-3">دفتر خودتان را در عطرمون بگشایید</h3>
            <p className="text-muted-foreground leading-7 text-sm">
              عطرفروش هستید؟ فروشگاهتان را معرفی کنید، رایحه‌ها را با حجم و بطری دلخواه عرضه کنید، و سفارش‌ها را مستقیم دریافت کنید.
            </p>
          </div>
          <div className="md:text-left">
            <Link to="/register/seller"><Button size="lg" className="font-serif">ثبت‌نام فروشنده</Button></Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
