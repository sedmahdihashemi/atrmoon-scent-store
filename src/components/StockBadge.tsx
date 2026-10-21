import { Clock } from "lucide-react";

// Small storefront tag for products fulfilled from the warehouse (ships a bit
// later than in-stock items). Renders nothing when there's no badge text.
export function StockBadge({ text, className = "" }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm bg-[var(--gold)]/12 text-[var(--gold-deep)] px-2 py-0.5 text-[10px] font-serif whitespace-nowrap ${className}`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      {text}
    </span>
  );
}
