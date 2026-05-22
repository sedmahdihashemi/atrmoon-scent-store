export function PersianArch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 100" className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 99 V40 C2 18, 18 2, 40 2 C62 2, 78 18, 78 40 V99" strokeLinecap="round" />
      <path d="M10 99 V42 C10 22, 24 10, 40 10 C56 10, 70 22, 70 42 V99" opacity="0.45" />
    </svg>
  );
}

export function Crescent({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M34 6 A18 18 0 1 0 34 42 A14 14 0 1 1 34 6 Z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 24" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M2 12 H80" />
      <circle cx="92" cy="12" r="2" />
      <path d="M100 12 C108 4, 116 4, 124 12 C132 20, 140 20, 148 12" />
      <circle cx="156" cy="12" r="2" />
      <path d="M164 12 H198" />
    </svg>
  );
}

export function ScentTrail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 20" className={className} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6">
      <path d="M2 10 C 20 2, 30 18, 50 10 S 80 2, 100 10 S 118 18, 118 10" strokeLinecap="round" />
    </svg>
  );
}

// ── Fragrance family icons — hand-drawn ink style ───────────────────
const baseIcon = "transition-colors duration-700";

export function IconWood({ className = "" }: { className?: string }) {
  // Cedar / oud branch — for مردانه / Boisé
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 44 V10" />
      <path d="M24 18 L14 12 M24 18 L34 12" />
      <path d="M24 26 L12 22 M24 26 L36 22" />
      <path d="M24 34 L15 32 M24 34 L33 32" />
      <circle cx="24" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconRose({ className = "" }: { className?: string }) {
  // Rose bud — for زنانه / Floral
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 8 C16 8 12 16 16 22 C12 24 14 32 22 30 C20 38 30 40 30 32 C38 34 40 24 34 22 C38 16 32 8 24 8 Z" />
      <path d="M24 18 C22 20 22 24 24 26 C26 24 26 20 24 18 Z" />
      <path d="M24 30 V44" />
      <path d="M24 38 C20 38 18 34 18 32" />
    </svg>
  );
}

export function IconMoonSun({ className = "" }: { className?: string }) {
  // Moon + sun balance — for یونیسکس / Unisex
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="10" />
      <path d="M24 14 A10 10 0 0 0 24 34 A7 7 0 0 1 24 14 Z" fill="currentColor" opacity="0.18" />
      <g opacity="0.7">
        <path d="M24 4 V8" /><path d="M24 40 V44" />
        <path d="M4 24 H8" /><path d="M40 24 H44" />
        <path d="M9 9 L12 12" /><path d="M36 36 L39 39" />
        <path d="M39 9 L36 12" /><path d="M12 36 L9 39" />
      </g>
    </svg>
  );
}

export function IconVial({ className = "" }: { className?: string }) {
  // Apothecary vial / dropper — for نیش / Niche
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4 H28" />
      <path d="M21 4 V14 L14 36 C13 40 16 44 20 44 H28 C32 44 35 40 34 36 L27 14 V4" />
      <path d="M17 28 H31" />
      <circle cx="22" cy="34" r="1.3" fill="currentColor" />
      <circle cx="27" cy="38" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconLeaf({ className = "" }: { className?: string }) {
  // Leaf / fresh — for اقتصادی / Daily
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 40 C 8 22, 22 8, 40 8 C 40 26, 26 40, 8 40 Z" />
      <path d="M10 38 C 20 28, 30 18, 38 10" />
      <path d="M18 30 L22 26" /><path d="M24 24 L28 20" />
    </svg>
  );
}

export function IconCrown({ className = "" }: { className?: string }) {
  // Crown / maison — for لوکس / Maison
  return (
    <svg viewBox="0 0 48 48" className={`${baseIcon} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 36 L10 16 L18 24 L24 12 L30 24 L38 16 L42 36 Z" />
      <path d="M10 40 H38" />
      <circle cx="10" cy="14" r="1.4" fill="currentColor" />
      <circle cx="24" cy="10" r="1.4" fill="currentColor" />
      <circle cx="38" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}
