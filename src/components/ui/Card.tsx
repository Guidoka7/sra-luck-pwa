import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import "./AdminCompactStyles.module.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-glass luxury-ring rounded-3xl", className)} {...props} />;
}

/**
 * Mantido como componente de compatibilidade para os layouts existentes.
 * Os estilos agora vivem em CSS Module para evitar mismatch de hidratação
 * causado por texto CSS inline dentro de <style> no SSR do Next.js.
 */
export function AdminCompactStyles() {
  return null;
}
