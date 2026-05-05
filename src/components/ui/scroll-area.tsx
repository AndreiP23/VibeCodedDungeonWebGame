import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

export function ScrollArea({ children, className }: ScrollAreaProps) {
  return <div className={cn("overflow-y-auto", className)}>{children}</div>;
}
