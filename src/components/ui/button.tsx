import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-display uppercase tracking-wider text-xs transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torch disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-4 border-torch bg-torch text-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary:
          "border-4 border-text-dim bg-bg text-text-dim shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ghost:
          "border-2 border-transparent bg-transparent text-text-dim hover:text-torch hover:border-torch",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-[10px]",
        lg: "h-12 px-8 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
