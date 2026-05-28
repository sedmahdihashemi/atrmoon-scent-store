import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import {
  PersianArch, Crescent, Flourish, ScentTrail,
  IconWood, IconRose, IconMoonSun, IconVial, IconLeaf, IconCrown,
} from "@/components/visual/PersianOrnament";
import { AtrmoonLoader } from "@/components/visual/AtrmoonLoader";
import heroImg from "@/assets/hero-perfume-2.jpg";
import bannerBottle from "@/assets/banner-bottle.jpg";
import bannerDeer from "@/assets/banner-deer.jpg";
import { BestSellers } from "@/components/home/BestSellers";
import { Sparkles, Truck, ShieldCheck, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <PublicLayout>
      <AtrmoonLoader />
      {/* ── Hero — a single bottle in moonlight ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-10 md:pt-16 pb-12 md:pb-16">
          <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
            {/* Left — editorial text column */}
            <div className="md:col-span-7 md:order-1 relative">
              <div className="eyebrow animate-moon-rise">شماره‌ی نخست · پاییز ۱۴۰۳</div>
              <h1 className="heading-display mt-6 text-[20vw] md:text-[8rem] lg:text-[9rem] leading-[0.95] text-ink animate-ink-bloom break-words">
                عطرمون
              </h1>
              <div className="mt-6 animate-scent-trail origin-right">
                <ScentTrail className="w-48 text-gold" />
              </div>
              <p className="pull-quote mt-6 max-w-lg animate-moon-rise delay-400">
                «هر رایحه‌ای، خاطره‌ایست که هنوز نوشته نشده.»
              </p>
              <p className="mt-4 max-w-lg text-ink-soft leading-[1.9] text-[15px] animate-moon-rise delay-600">
                در عطرمون، آرام پرسه می‌زنیم میان عطرفروشی‌های مستقل ایران. بطری به بطری، حجم به حجم،
                خاطره به خاطره. این‌جا خرید نیست؛ گفت‌وگوست.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 animate-moon-rise delay-800">
                <Link to="/products"><Button variant="default" size="xl">پرسه میان رایحه‌ها</Button></Link>
                <Link to="/stores"><Button variant="outline" size="xl">عطاری عطرفروشان</Button></Link>
              </div>
            </div>

            {/* Right — arch-framed perfume in moonlight */}
            <div className="md:col-span-5 md:order-2 relative">
              <div className="vlabel absolute right-[-2rem] top-2 hidden md:block">EDITION I · ATRMOON</div>
              <div className="relative animate-drift">
                <div className="arch-frame paper-grain shadow-elevated relative">
                  <img
                    src={heroImg}
                    alt="بطری عطر در مهتاب"
                    width={960}
                    height={1280}
                    className="w-full h-[520px] md:h-[620px] object-cover"
                  />
                </div>
                <Crescent className="absolute -top-6 -left-6 w-14 h-14 text-gold/80 animate-moon-rise delay-400" />
                <div className="absolute -bottom-6 right-4 paper-card bg-paper px-5 py-3 paper-grain">
                  <div className="eyebrow">یادداشت سرسخن</div>
                  <div className="font-serif text-ink text-sm mt-1 italic">شبی برای یک عطر.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4">
          <Flourish className="w-full max-w-md mx-auto text-ink/40" />
        </div>
      </section>

      {/* ── Editorial intro — a slow paragraph ─────────────────────────── */}
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="eyebrow ornament mb-4">سرآغاز</div>
          <h2 className="heading-display text-3xl md:text-5xl text-ink">
            بازاری آرام، بی‌شتاب، انسانی.
          </h2>
          <div className="gold-divider w-24 mx-auto my-5" />
          <p className="text-ink-soft leading-[1.95] text-[16px] text-justify">
            عطرمون مجموعه‌ای از عطرفروشان مستقل ایرانی است. هر فروشنده، عطاری خودش را دارد؛ رایحه‌ها را خودش معرفی می‌کند،
            با خریدار خودش گفت‌وگو می‌کند، و سفارش را با دست‌های خودش می‌بندد. این‌جا تخفیف فریاد نمی‌زند، و آگهی چشمک نمی‌زند.
            این‌جا فقط رایحه‌هاست و کسانی که آن‌ها را دوست می‌دارند.
          </p>
        </div>
      </section>

      {/* ── Fragrance families — arch cards ────────────────────────────── */}
      <section className="container mx-auto px-4 py-10 md:py-14">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <div className="eyebrow">فصلِ یکم</div>
            <h2 className="heading-display text-3xl md:text-4xl text-ink mt-2">خانواده‌های رایحه</h2>
          </div>
          <Link to="/products" className="hidden md:inline-block text-sm text-ink-soft hover:text-gold-deep transition-colors duration-700 border-b border-ink/20 pb-0.5">
            همه‌ی رایحه‌ها ←
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 md:gap-6">
          {[
            { fa: "مردانه", en: "Boisé",  Icon: IconWood },
            { fa: "زنانه",  en: "Floral", Icon: IconRose },
            { fa: "یونیسکس", en: "Unisex", Icon: IconMoonSun },
            { fa: "نیش",    en: "Niche",  Icon: IconVial },
            { fa: "اقتصادی", en: "Daily", Icon: IconLeaf },
            { fa: "لوکس",   en: "Maison", Icon: IconCrown },
          ].map(({ fa, en, Icon }, i) => (
            <Link
              key={fa}
              to="/products"
              className="group block"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="paper-card paper-card-hover paper-grain arch-frame h-48 flex flex-col items-center justify-end pb-5 text-center px-3 relative">
                <Icon className="absolute inset-x-0 top-5 mx-auto w-12 h-12 text-ink/55 group-hover:text-gold-deep" />
                <div className="absolute top-[5.25rem] left-0 right-0 text-center">
                  <ScentTrail className="w-16 mx-auto text-gold/70 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                </div>
                <div className="font-serif text-ink text-lg">{fa}</div>
                <div className="eyebrow text-[0.6rem] mt-1 text-ink-soft/70">{en}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Editorial split — two columns like an old newspaper ────────── */}
      <section className="container mx-auto px-4 py-14 md:py-16">
        <div className="dotted-divider max-w-md mx-auto mb-10" />
        <div className="grid md:grid-cols-12 gap-8 md:gap-12">
          <div className="md:col-span-5">
            <div className="vlabel hidden md:inline-block float-left mr-4 mt-2">SECTION · II</div>
            <div className="eyebrow mb-3">یادداشتِ ماه</div>
            <h3 className="heading-display text-3xl md:text-4xl text-ink leading-tight">
              عطر، تنها بویی نیست؛
              <br/>
              <span className="italic text-gold-deep">صدایی‌ست از روزی دیگر.</span>
            </h3>
          </div>
          <div className="md:col-span-7 text-ink-soft leading-[1.95] text-[15px] columns-1 md:columns-2 gap-8">
            <p>
              در عطرمون، رایحه را کالا نمی‌بینیم. آن را یک یادداشت کوتاه می‌دانیم؛ چند کلمه‌ای که از پشت سال‌ها برمی‌گردد و
              کنار گوشت می‌نشیند. به همین خاطر، صفحه‌ی هر عطر بیش از آن‌که قفسه‌ی فروشگاه باشد، صفحه‌ی یک کتاب کوچک است.
            </p>
            <p className="mt-4">
              فروشنده‌ی هر رایحه، نویسنده‌ی همان صفحه‌ست. حجم و بطری و قیمت را خودش انتخاب می‌کند، و اگر بخواهی،
              می‌توانی پیش از خرید با او گفت‌وگو کنی. آرام، بی‌شتاب، انسانی.
            </p>
          </div>
        </div>
        <div className="dotted-divider max-w-md mx-auto mt-10" />
      </section>

      {/* ── Cinematic banner — bottle on aged paper ───────────────────── */}
      <section className="container mx-auto px-4 pb-14">
        <div className="relative arch-frame overflow-hidden paper-grain shadow-elevated group">
          <img
            src={bannerBottle}
            alt="بطری عطر بر کاغذ کهنه"
            loading="lazy"
            width={1920}
            height={1080}
            className="w-full h-[280px] md:h-[460px] object-cover transition-transform duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-paper/90 via-paper/30 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="px-8 md:px-16 max-w-md text-right ml-auto">
              <div className="eyebrow mb-4">شبی برای یک رایحه</div>
              <h3 className="heading-display text-2xl md:text-4xl text-ink leading-tight">
                هر شیشه، صفحه‌ای‌ست<br/>
                <span className="italic text-gold-deep">از کتابی نانوشته.</span>
              </h3>
              <div className="gold-divider w-16 mt-5 mr-0 ml-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Three pillars ──────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-10 md:py-14">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { t: "حجم به انتخاب تو", d: "از سَمپلِ نیم‌میلی‌لیتری تا بطری کامل. هر رایحه را به اندازه‌ی همان شب می‌خری." },
            { t: "گفت‌وگو با فروشنده", d: "پیش از خرید بپرس، بشنو. هر عطرفروش، عطاری خودش را دارد و خودش پاسخ می‌دهد." },
            { t: "بسته‌بندی با حوصله", d: "هر بسته، با کاغذ و دست‌خط و یک یادداشت کوچک می‌رسد." },
          ].map((p, i) => (
            <div key={p.t} className="paper-card paper-grain p-6 text-center" style={{ animation: `moon-rise 900ms var(--ease-moon) ${i * 120}ms both` }}>
              <PersianArch className="w-9 h-11 mx-auto text-gold mb-3" />
              <h4 className="font-serif text-ink text-xl mb-2">{p.t}</h4>
              <p className="text-ink-soft text-sm leading-[1.85]">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Full-bleed arch & crescent banner ─────────────────────────── */}
      <section className="relative py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="relative rounded-md overflow-hidden paper-grain">
            <img
              src={bannerDeer}
              alt="آهوی ختن و هلال ماه — یادآور مشک آهو"
              loading="lazy"
              width={1920}
              height={1080}
              className="w-full h-[260px] md:h-[420px] object-cover animate-drift"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/10 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-10 text-center">
              <div className="eyebrow mb-3 text-ink-soft">آهویِ خاطره</div>
              <p className="font-serif italic text-ink text-lg md:text-2xl max-w-xl mx-auto leading-[1.9]">
                «رم آهوی تصویرم شتاب ساکنی دارم»
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Seller invite — quiet invitation ───────────────────────────── */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="paper-card paper-grain p-8 md:p-12 grid md:grid-cols-12 gap-8 items-center bg-gradient-paper">
          <div className="md:col-span-7">
            <div className="eyebrow ornament mb-4">دعوت</div>
            <h3 className="heading-display text-3xl md:text-4xl text-ink leading-tight">
              عطاری خودت را در عطرمون بگشا.
            </h3>
            <p className="mt-4 text-ink-soft leading-[1.9] text-[15px] max-w-xl">
              اگر عطرفروشی، این‌جا جایی‌ست برای عطاریی از آنِ تو؛ بی‌واسطه، آرام، و با شکل و رنگِ خودت.
            </p>
          </div>
          <div className="md:col-span-5 md:text-left">
            <Link to="/register/seller">
              <Button variant="gold" size="xl">گشودنِ عطاری</Button>
            </Link>
            <p className="mt-4 text-xs text-ink-soft/70 font-serif italic">
              ثبت‌نام رایگان است · تأیید با حوصله انجام می‌شود
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing whisper ────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-12 text-center">
        <Flourish className="w-56 mx-auto text-ink/30 mb-4" />
        <p className="font-serif italic text-ink-soft text-lg">
          عطرمون · بی‌شتاب، بی‌فریاد، بی‌نمایش.
        </p>
      </section>
    </PublicLayout>
  );
}
