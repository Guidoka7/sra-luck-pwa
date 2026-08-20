"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export interface ChartDatum {
  label: string;
  value: number;
  secondaryValue?: number;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <span className="inline-flex rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-burgundy/70 shadow-sm backdrop-blur">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-3 text-3xl text-burgundy sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-clay/60">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "rounded-[28px] border-white/70 bg-white/80 shadow-[0_24px_80px_-32px_rgba(122,38,50,0.26)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </Card>
  );
}

export function SectionHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl text-burgundy">{title}</h2>
        {description ? <p className="mt-1 text-sm text-clay/50">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function TrendBadge({
  value,
}: {
  value: number;
}) {
  const positivo = value > 0;
  const negativo = value < 0;
  const Icon = positivo ? ArrowUpRight : negativo ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        positivo && "bg-success/10 text-success",
        negativo && "bg-alert/10 text-alert",
        !positivo && !negativo && "bg-clay/10 text-clay/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {positivo ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  trend,
  tone = "burgundy",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
  trend?: number;
  tone?: "burgundy" | "success" | "alert" | "gold" | "indigo" | "neutral";
}) {
  const tones = {
    burgundy: "bg-burgundy text-cream shadow-[0_20px_40px_-22px_rgba(110,37,54,0.7)]",
    success: "bg-success text-white shadow-[0_20px_40px_-22px_rgba(59,122,78,0.65)]",
    alert: "bg-alert text-white shadow-[0_20px_40px_-22px_rgba(178,59,59,0.65)]",
    gold: "bg-gold text-burgundy shadow-[0_20px_40px_-22px_rgba(217,196,178,0.85)]",
    indigo: "bg-rose-dark text-pearl shadow-[0_20px_40px_-22px_rgba(122,38,50,0.58)]",
    neutral: "bg-blush text-burgundy",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38 }}
    >
      <Panel className="h-full p-5">
        <div className="flex items-start justify-between gap-4">
          <div className={cn("rounded-2xl p-3", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          {typeof trend === "number" ? <TrendBadge value={trend} /> : null}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-burgundy/45">{label}</p>
        <p className="mt-2 text-3xl text-burgundy">{value}</p>
        <p className="mt-2 text-sm text-clay/55">{helper}</p>
      </Panel>
    </motion.div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "alert" | "gold" | "rose" | "indigo";
}) {
  const tones = {
    neutral: "bg-blush/60 text-burgundy/70",
    success: "bg-success/10 text-success",
    alert: "bg-alert/10 text-alert",
    gold: "bg-gold/15 text-burgundy",
    rose: "bg-rose/15 text-burgundy",
    indigo: "bg-burgundy text-pearl",
  };

  return <span className={cn("rounded-full px-3 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function BarChart({
  data,
  colorClassName = "bg-burgundy",
  formatter = (value: number) => value.toString(),
}: {
  data: ChartDatum[];
  colorClassName?: string;
  formatter?: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const width = `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 2)}%`;
        return (
          <motion.div
            key={`${item.label}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.28 }}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-clay/65">{item.label}</span>
              <span className="font-medium text-burgundy">{formatter(item.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-blush/60">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width }}
                transition={{ delay: index * 0.04 + 0.08, duration: 0.45 }}
                className={cn("h-full rounded-full", colorClassName)}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DualBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColorClassName = "bg-burgundy",
  secondaryColorClassName = "bg-rose/50",
}: {
  data: ChartDatum[];
  primaryLabel: string;
  secondaryLabel: string;
  primaryColorClassName?: string;
  secondaryColorClassName?: string;
}) {
  const max = Math.max(
    ...data.flatMap((item) => [item.value, item.secondaryValue ?? 0]),
    1
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-clay/55">
        <span className="inline-flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", primaryColorClassName)} />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", secondaryColorClassName)} />
          {secondaryLabel}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-3 sm:grid-cols-12">
        {data.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex flex-col items-center gap-2">
            <div className="flex h-44 w-full items-end gap-1 rounded-3xl bg-blush/35 px-2 py-3">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${((item.value ?? 0) / max) * 100}%` }}
                transition={{ delay: index * 0.04, duration: 0.45 }}
                className={cn("w-1/2 rounded-full", primaryColorClassName)}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(((item.secondaryValue ?? 0) || 0) / max) * 100}%` }}
                transition={{ delay: index * 0.04 + 0.06, duration: 0.45 }}
                className={cn("w-1/2 rounded-full", secondaryColorClassName)}
              />
            </div>
            <span className="text-xs text-clay/55">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const total = Math.max(data.reduce((sum, item) => sum + item.value, 0), 1);
  let offset = 0;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-52 w-52 sm:mx-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="44" stroke="#F1F5F9" strokeWidth="14" fill="transparent" />
          {data.map((item, index) => {
            const percentage = item.value / total;
            const dash = percentage * 276.46;
            const circle = (
              <motion.circle
                key={`${item.label}-${index}`}
                cx="60"
                cy="60"
                r="44"
                fill="transparent"
                stroke={item.color}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${dash} 276.46`}
                strokeDashoffset={-offset}
                initial={{ strokeDasharray: `0 276.46` }}
                animate={{ strokeDasharray: `${dash} 276.46` }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-[0.24em] text-clay/40">Total</span>
          <span className="text-3xl text-burgundy">{total}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {data.map((item) => {
          const percent = (item.value / total) * 100;
          return (
            <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-blush/35 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-clay/70">{item.label}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-burgundy">{item.value}</p>
                <p className="text-xs text-clay/45">{percent.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-rose/20 bg-white/50 px-6 py-10 text-center">
      <p className="text-lg text-burgundy">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-clay/55">{description}</p>
    </div>
  );
}
