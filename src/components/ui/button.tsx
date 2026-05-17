import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-ink text-primary-foreground shadow-paper hover:shadow-elevated hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-paper hover:bg-destructive/90 hover:-translate-y-0.5",
        outline:
          "border border-ink/15 bg-transparent hover:border-[var(--gold)] hover:text-[var(--gold-deep)] hover:bg-[var(--gold)]/5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-paper hover:bg-secondary/80",
        ghost: "hover:bg-ink/5 hover:text-foreground",
        link: "text-[var(--gold-deep)] underline-offset-4 hover:underline",
        gold:
          "bg-gradient-gold text-[oklch(0.18_0.018_60)] shadow-gold hover:shadow-elevated hover:-translate-y-0.5 font-semibold",
        moon:
          "bg-[var(--moon)] text-ink border border-ink/10 shadow-paper hover:border-[var(--gold)]/40 hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-base tracking-wide",
        icon: "h-10 w-10",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
