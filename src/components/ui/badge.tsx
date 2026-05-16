import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-2 px-2 py-0.5 text-[10px] font-display uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-torch bg-bg text-torch",
        secondary: "border-text-dim bg-bg text-text-dim",
        success: "border-xp bg-bg text-xp",
        danger: "border-hp bg-bg text-hp",
        gold: "border-gold bg-bg text-gold",
        "gem-purple": "border-gem-purple bg-bg text-gem-purple",
        "gem-blue": "border-gem-blue bg-bg text-gem-blue",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
