import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "atrmoon_install_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

// A single, unified "install the app" pill. Registers the service worker,
// listens for the install prompt (Android/Chrome), and on iOS shows the
// add-to-home-screen steps instead (iOS has no install prompt).
export function InstallButton() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const ios = mounted && isIOS();

  useEffect(() => {
    setMounted(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.error("[pwa] sw register failed", e));
    }
    setInstalled(isStandalone());
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* ignore */ }

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
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
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else if (ios) {
      setShowIosHelp(true);
    }
  };

  // Nothing to show when already installed, dismissed, or not installable.
  if (installed || dismissed) return null;
  const canShow = !!deferred || ios;
  if (!canShow) return null;

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

      {showIosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 p-4" onClick={() => setShowIosHelp(false)}>
          <div className="paper-card rounded-md p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-ink">نصب روی آیفون</h3>
              <button onClick={() => setShowIosHelp(false)} aria-label="بستن" className="text-ink/50 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            <ol className="space-y-3 text-sm font-serif text-ink/80">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--gold)]/15 text-[var(--gold-deep)] flex items-center justify-center text-xs shrink-0">۱</span>
                روی دکمه‌ی <Share className="w-4 h-4 inline text-[var(--gold-deep)]" /> «اشتراک‌گذاری» در نوار سافاری بزنید.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--gold)]/15 text-[var(--gold-deep)] flex items-center justify-center text-xs shrink-0">۲</span>
                گزینه‌ی <Plus className="w-4 h-4 inline text-[var(--gold-deep)]" /> «افزودن به صفحه‌ی اصلی» را انتخاب کنید.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--gold)]/15 text-[var(--gold-deep)] flex items-center justify-center text-xs shrink-0">۳</span>
                روی «افزودن» بزنید — عطرمون روی صفحه‌ی اصلی‌تان نصب می‌شود.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
