import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-glass luxury-ring rounded-3xl", className)} {...props} />;
}

export function AdminCompactStyles() {
  return <style>{`
    .admin-compact [class~="p-6"] { padding: 1rem !important; }
    .admin-compact [class~="p-8"] { padding: 1.25rem !important; }
    .admin-compact [class~="px-6"] { padding-left: 1rem !important; padding-right: 1rem !important; }
    .admin-compact [class~="py-6"] { padding-top: 1rem !important; padding-bottom: 1rem !important; }
    .admin-compact [class~="px-5"] { padding-left: .875rem !important; padding-right: .875rem !important; }
    .admin-compact [class~="py-5"] { padding-top: .875rem !important; padding-bottom: .875rem !important; }
    .admin-compact [class~="gap-6"] { gap: 1rem !important; }
    .admin-compact [class~="gap-5"] { gap: .875rem !important; }
    .admin-compact [class~="space-y-6"] > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem !important; }
    .admin-compact [class~="space-y-5"] > :not([hidden]) ~ :not([hidden]) { margin-top: .875rem !important; }
    .admin-compact [class~="mb-8"] { margin-bottom: 1rem !important; }
    .admin-compact [class~="mt-8"] { margin-top: 1rem !important; }
    .admin-compact [class~="mb-6"] { margin-bottom: 1rem !important; }
    .admin-compact [class~="mt-6"] { margin-top: 1rem !important; }
    .admin-compact [class*="rounded-[28px]"] { border-radius: 1rem !important; }
    .admin-compact [class*="rounded-[24px]"] { border-radius: .875rem !important; }
    .admin-compact [class*="rounded-[22px]"] { border-radius: .75rem !important; }
    .admin-compact [class~="rounded-3xl"] { border-radius: 1rem !important; }
    .admin-compact [class~="rounded-2xl"] { border-radius: .875rem !important; }
    .admin-compact [class~="h-44"] { height: 8rem !important; }
    .admin-compact [class~="min-h-[240px]"] { min-height: 9rem !important; }
    .admin-compact [class~="min-h-[220px]"] { min-height: 9rem !important; }
    .admin-compact [class~="min-h-[200px]"] { min-height: 8rem !important; }
  `}</style>;
}
