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
