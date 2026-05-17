import { useEffect, useState } from "react";
import { Crescent } from "./PersianOrnament";

const KEY = "atrmoon:welcomed";

export function AtrmoonLoader() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(KEY) !== "1";
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t1 = setTimeout(() => setFading(true), 1800);
    const t2 = setTimeout(() => {
      sessionStorage.setItem(KEY, "1");
      setShow(false);
    }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-paper paper-grain transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <Crescent className="w-12 h-12 text-gold animate-moon-rise" />
        <div className="font-serif text-ink text-5xl md:text-6xl animate-ink-bloom" style={{ letterSpacing: "0.02em" }}>
          عطرمون
        </div>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-gold-deep to-transparent animate-ink-bloom" style={{ animationDelay: "300ms" }} />
        <p className="font-serif italic text-ink-soft text-sm animate-ink-bloom" style={{ animationDelay: "600ms" }}>
          آرام بِنشین… رایحه‌ای می‌آید.
        </p>
      </div>
    </div>
  );
}
