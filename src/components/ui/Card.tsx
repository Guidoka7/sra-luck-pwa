import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-glass luxury-ring rounded-3xl",
        className
      )}
      {...props}
    />
  );
}
