import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { PersianArch, Crescent, Flourish, ScentTrail } from "@/components/visual/PersianOrnament";
import heroImg from "@/assets/hero-perfume-2.jpg";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <PublicLayout>
      {/* ── Hero — a single bottle in moonlight ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-24 md:pb-32">
          <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-end">
            {/* Left — editorial text column */}
            <div className="md:col-span-7 md:order-1 relative">
              <div className="eyebrow animate-moon-rise">شماره‌ی نخست · پاییز ۱۴۰۳</div>
              <h1 className="heading-display mt-6 text-[20vw] md:text-[8rem] lg:text-[9rem] leading-[0.95] text-ink animate-ink-bloom break-words">
                عطر<span className="text-gold-deep">مون</span>
              </h1>
              <div className="mt-6 animate-scent-trail origin-right">
                <ScentTrail className="w-48 text-gold" />
              </div>
              <p className="pull-quote mt-8 max-w-lg animate-moon-rise delay-400">
                «هر رایحه‌ای، خاطره‌ایست که هنوز نوشته نشده.»
              </p>
              <p className="mt-6 max-w-lg text-ink-soft leading-[2.1] text-[15px] animate-moon-rise delay-600">
                در عطرمون، آرام پرسه می‌زنیم میان عطرفروشی‌های مستقل ایران. بطری به بطری، حجم به حجم،
                خاطره به خاطره. این‌جا خرید نیست؛ گفت‌وگوست.
              </p>
              <div className="mt-12 flex flex-wrap gap-3 animate-moon-rise delay-800">
                <Link to="/products"><Button variant="default" size="xl">پرسه میان رایحه‌ها</Button></Link>
                <Link to="/stores"><Button variant="outline" size="xl">دفتر عطرفروشان</Button></Link>
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
                    width={960} height={1280}
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
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center">
          <div className="eyebrow ornament mb-6">سرآغاز</div>
          <h2 className="heading-display text-3xl md:text-5xl text-ink">
            پاساژی آرام، بی‌شتاب، انسانی.
          </h2>
          <div className="gold-divider w-24 mx-auto my-8" />
          <p className="drop-cap text-ink-soft leading-[2.2] text-[16px] text-justify">
            عطرمون مجموعه‌ای از عطرفروشان مستقل ایرانی است. هر فروشنده، دفتر خودش را دارد؛ رایحه‌ها را خودش معرفی می‌کند،
            با خریدار خودش گفت‌وگو می‌کند، و سفارش را با دست‌های خودش می‌بندد. این‌جا تخفیف فریاد نمی‌زند، و آگهی چشمک نمی‌زند.
            این‌جا فقط رایحه‌هاست و کسانی که آن‌ها را دوست می‌دارند.
          </p>
        </div>
      </section>

      {/* ── Fragrance families — arch cards ────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="flex items-end justify-between mb-12 gap-4">
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
            { fa: "مردانه", en: "Boisé" },
            { fa: "زنانه", en: "Floral" },
            { fa: "یونیسکس", en: "Unisex" },
            { fa: "نیش", en: "Niche" },
            { fa: "اقتصادی", en: "Daily" },
            { fa: "لوکس", en: "Maison" },
          ].map((c, i) => (
            <Link
              key={c.fa}
              to="/products"
              className="group block"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="paper-card paper-card-hover paper-grain arch-frame h-44 flex flex-col items-center justify-end pb-5 text-center px-3 relative">
                <PersianArch className="absolute inset-x-0 top-3 mx-auto w-12 text-gold/40 group-hover:text-gold transition-colors duration-700" />
                <div className="absolute top-16 left-0 right-0 text-center">
                  <ScentTrail className="w-16 mx-auto text-gold/60 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                </div>
                <div className="font-serif text-ink text-lg">{c.fa}</div>
                <div className="eyebrow text-[0.6rem] mt-1 text-ink-soft/70">{c.en}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Editorial split — two columns like an old newspaper ────────── */}
      <section className="container mx-auto px-4 py-24">
        <div className="dotted-divider max-w-md mx-auto mb-16" />
        <div className="grid md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-5">
            <div className="vlabel hidden md:inline-block float-left mr-4 mt-2">SECTION · II</div>
            <div className="eyebrow mb-3">یادداشتِ ماه</div>
            <h3 className="heading-display text-3xl md:text-4xl text-ink leading-tight">
              عطر، تنها بویی نیست؛
              <br/>
              <span className="italic text-gold-deep">صدایی‌ست از روزی دیگر.</span>
            </h3>
          </div>
          <div className="md:col-span-7 text-ink-soft leading-[2.2] text-[15px] columns-1 md:columns-2 gap-10">
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
        <div className="dotted-divider max-w-md mx-auto mt-16" />
      </section>

      {/* ── Three pillars ──────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { t: "حجم به انتخاب تو", d: "از سَمپلِ نیم‌میلی‌لیتری تا بطری کامل. هر رایحه را به اندازه‌ی همان شب می‌خری." },
            { t: "گفت‌وگو با فروشنده", d: "پیش از خرید بپرس، بشنو. هر عطرفروش، دفتر خودش را دارد و خودش پاسخ می‌دهد." },
            { t: "بسته‌بندی با حوصله", d: "هر بسته، با کاغذ و دست‌خط و یک یادداشت کوچک می‌رسد." },
          ].map((p, i) => (
            <div key={p.t} className="paper-card paper-grain p-8 text-center" style={{ animation: `moon-rise 900ms var(--ease-moon) ${i * 120}ms both` }}>
              <PersianArch className="w-10 h-12 mx-auto text-gold mb-4" />
              <h4 className="font-serif text-ink text-xl mb-2">{p.t}</h4>
              <p className="text-ink-soft text-sm leading-[2]">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Seller invite — quiet invitation ───────────────────────────── */}
      <section className="container mx-auto px-4 py-24">
        <div className="paper-card paper-grain p-10 md:p-16 grid md:grid-cols-12 gap-10 items-center bg-gradient-paper">
          <div className="md:col-span-7">
            <div className="eyebrow ornament mb-5">دعوت</div>
            <h3 className="heading-display text-3xl md:text-4xl text-ink leading-tight">
              دفتر خودت را در عطرمون بگشا.
            </h3>
            <p className="mt-5 text-ink-soft leading-[2] text-[15px] max-w-xl">
              اگر عطرفروشی، این‌جا جایی‌ست برای دفتری از آنِ تو؛ بی‌واسطه، آرام، و با شکل و رنگِ خودت.
            </p>
          </div>
          <div className="md:col-span-5 md:text-left">
            <Link to="/register/seller">
              <Button variant="gold" size="xl">گشودنِ دفتر</Button>
            </Link>
            <p className="mt-4 text-xs text-ink-soft/70 font-serif italic">
              ثبت‌نام رایگان است · تأیید با حوصله انجام می‌شود
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing whisper ────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-24 text-center">
        <Flourish className="w-64 mx-auto text-ink/30 mb-6" />
        <p className="font-serif italic text-ink-soft text-lg">
          عطرمون · بی‌شتاب، بی‌فریاد، بی‌نمایش.
        </p>
      </section>
    </PublicLayout>
  );
}
