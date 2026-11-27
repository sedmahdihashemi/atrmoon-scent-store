import { useEffect, useState } from "react";
import { Download, Share, X, Plus, MoreVertical, ExternalLink } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "atrmoon_install_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

// --- Browser / platform sniffing (best-effort; only used to pick the right
//     manual-install instructions when no native prompt is available) --------
function ua() {
  return typeof navigator === "undefined" ? "" : navigator.userAgent || "";
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(ua()) && !(typeof window !== "undefined" && (window as any).MSStream);
}
function isAndroid() {
  return /android/i.test(ua());
}
// In-app webviews (Instagram, Facebook, Telegram, Bale, …) can't install a PWA;
// the user must first open the page in the real browser.
function isInApp() {
  const s = ua();
  return /\b(FBAN|FBAV|Instagram|Telegram|Line|Twitter|GSA|Snapchat)\b/i.test(s) ||
    (/\bwv\b/i.test(s) && isAndroid()); // Android WebView flag
}
function isFirefox() {
  return /firefox|fxios/i.test(ua());
}

// A single, unified "install the app" pill. On Chromium it triggers the real
// install prompt; everywhere else it opens step-by-step instructions tailored
// to the browser (iOS Safari, Android menu, Firefox, in-app browsers…), so the
// button is useful on EVERY browser instead of only Chrome.
export function InstallButton() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.error("[pwa] sw register failed", e));
    }
    setInstalled(isStandalone());
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* ignore */ }

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setShowHelp(false); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  const onInstall = async () => {
    if (deferred) {
      // Native install (Chrome / Edge / Samsung / Brave …)
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // No native prompt → show manual steps for this browser.
    setShowHelp(true);
  };

  // Hide only when already installed or the user dismissed it. Otherwise the
  // pill shows on every browser (we always have *some* guidance to give).
  if (!mounted || installed || dismissed) return null;

  return (
    <>
      <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink text-[var(--paper)] shadow-lg shadow-ink/20 pr-2 pl-1 py-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <button onClick={onInstall} className="flex items-center gap-2 rounded-full px-4 py-2 font-serif text-sm hover:bg-white/5 transition">
            <Download className="w-4 h-4 text-[var(--gold)]" />
            نصب اپ عطرمون
          </button>
          <button onClick={dismiss} aria-label="بستن" className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--paper)]/60 hover:text-[var(--paper)] hover:bg-white/5 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHelp && <InstallHelp onClose={() => setShowHelp(false)} />}
    </>
  );
}

// Instructions sheet, chosen by platform. Covers: iOS Safari, in-app browsers,
// Android (Chrome/Firefox menu), and desktop.
function InstallHelp({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const inApp = isInApp();
  const android = isAndroid();
  const firefox = isFirefox();

  let title = "نصب اپ عطرمون";
  let steps: React.ReactNode[] = [];

  if (inApp) {
    title = "ابتدا در مرورگر باز کنید";
    steps = [
      <>روی دکمه‌ی منو <MoreVertical className="w-4 h-4 inline text-[var(--gold-deep)]" /> بالای صفحه بزنید.</>,
      <>گزینه‌ی <ExternalLink className="w-4 h-4 inline text-[var(--gold-deep)]" /> «باز کردن در مرورگر» (Chrome یا Safari) را انتخاب کنید.</>,
      <>در آن مرورگر، دوباره روی «نصب اپ عطرمون» بزنید.</>,
    ];
  } else if (ios) {
    title = "نصب روی آیفون";
    steps = [
      <>روی دکمه‌ی <Share className="w-4 h-4 inline text-[var(--gold-deep)]" /> «اشتراک‌گذاری» در نوار سافاری بزنید.</>,
      <>گزینه‌ی <Plus className="w-4 h-4 inline text-[var(--gold-deep)]" /> «افزودن به صفحه‌ی اصلی» را انتخاب کنید.</>,
      <>روی «افزودن» بزنید — عطرمون روی صفحه‌ی اصلی‌تان نصب می‌شود.</>,
    ];
  } else if (android) {
    title = firefox ? "نصب روی اندروید (فایرفاکس)" : "نصب روی اندروید";
    steps = [
      <>روی دکمه‌ی منو <MoreVertical className="w-4 h-4 inline text-[var(--gold-deep)]" /> (سه‌نقطه) مرورگر بزنید.</>,
      firefox
        ? <>گزینه‌ی «Install» یا «نصب» را انتخاب کنید.</>
        : <>گزینه‌ی <Plus className="w-4 h-4 inline text-[var(--gold-deep)]" /> «افزودن به صفحه اصلی» یا «نصب برنامه» را بزنید.</>,
      <>تأیید کنید — آیکن عطرمون روی صفحه‌ی اصلی می‌آید.</>,
    ];
  } else {
    title = "نصب روی کامپیوتر";
    steps = [
      <>روی آیکن نصب <Download className="w-4 h-4 inline text-[var(--gold-deep)]" /> در سمت چپِ نوار آدرس بزنید (یا منوی سه‌نقطه‌ی مرورگر).</>,
      <>گزینه‌ی «Install» / «نصب عطرمون» را انتخاب کنید.</>,
      <>روی «نصب» بزنید تا در یک پنجره‌ی مستقل باز شود.</>,
    ];
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="paper-card rounded-md p-6 max-w-sm w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">{title}</h3>
          <button onClick={onClose} aria-label="بستن" className="text-ink/50 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <ol className="space-y-3 text-sm font-serif text-ink/80">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-[var(--gold)]/15 text-[var(--gold-deep)] flex items-center justify-center text-xs shrink-0 mt-0.5">{["۱", "۲", "۳", "۴"][i]}</span>
              <span className="leading-7">{s}</span>
            </li>
          ))}
        </ol>
        {inApp && (
          <p className="text-[11px] text-muted-foreground leading-6">
            نکته: در مرورگرهای داخل اینستاگرام/تلگرام امکان نصب نیست؛ حتماً باید در Chrome یا Safari باز شود.
          </p>
        )}
      </div>
    </div>
  );
}
