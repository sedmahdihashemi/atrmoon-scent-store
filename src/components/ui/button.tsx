import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.99] font-serif tracking-wide",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink-deep)] text-primary-foreground shadow-paper hover:shadow-elevated hover:bg-[var(--ink)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-paper hover:bg-destructive/90",
        outline:
          "border border-ink/20 bg-transparent text-ink hover:border-[var(--gold)] hover:text-[var(--gold-deep)] hover:bg-[var(--gold)]/6",
        secondary:
          "bg-secondary text-secondary-foreground shadow-paper hover:bg-secondary/80",
        ghost: "hover:bg-ink/5 hover:text-foreground",
        link: "text-[var(--gold-deep)] underline-offset-4 hover:underline",
        gold:
          "bg-gradient-gold text-[var(--ink-deep)] shadow-gold hover:shadow-elevated",
        moon:
          "bg-[var(--moon)] text-ink border border-ink/10 shadow-paper hover:border-[var(--gold)]/40",
        tile:
          "bg-[var(--tile)] text-[var(--paper)] shadow-paper hover:bg-[var(--tile-deep)]",
      },
      size: {
        default: "h-11 px-6 py-2 text-sm",
        sm: "h-9 rounded-md px-4 text-xs",
        lg: "h-12 rounded-md px-9 text-base",
        xl: "h-14 rounded-md px-12 text-base tracking-[0.06em]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, disabled, onClick, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      if (loading) { e.preventDefault(); e.stopPropagation(); return; }
      onClick?.(e);
    };
    const content = asChild ? (
      children
    ) : (
      <>
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {loading && loadingText !== undefined ? loadingText : children}
      </>
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        onClick={handleClick}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
