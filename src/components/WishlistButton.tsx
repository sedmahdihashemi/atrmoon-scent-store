import { Heart } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

/**
 * Heart toggle. Use `variant="icon"` for compact card overlays, `variant="full"`
 * for the product detail page.
 */
export function WishlistButton({
  productId,
  variant = "icon",
  className,
}: {
  productId: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const { has, toggle, signedIn } = useWishlist();
  const navigate = useNavigate();
  const active = has(productId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) { navigate({ to: "/login" }); return; }
    void toggle(productId);
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center justify-center gap-2 h-12 px-5 rounded-md border font-serif text-sm transition",
          active
            ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-deep)]"
            : "border-ink/15 text-ink hover:border-[var(--gold)]",
          className,
        )}
      >
        <Heart className={cn("w-5 h-5", active && "fill-current")} />
        {active ? "در علاقه‌مندی‌هاست" : "افزودن به علاقه‌مندی"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"}
      className={cn(
        "absolute top-2 left-2 z-10 w-9 h-9 rounded-full bg-[var(--paper)]/90 backdrop-blur-sm border border-ink/10 flex items-center justify-center shadow-sm transition hover:scale-105",
        active ? "text-[var(--gold-deep)]" : "text-ink/60 hover:text-[var(--gold)]",
        className,
      )}
    >
      <Heart className={cn("w-4 h-4", active && "fill-current")} />
    </button>
  );
}