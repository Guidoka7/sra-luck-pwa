"use client";

import { LockKeyhole } from "lucide-react";
import { CalendarioAgendamento, DataDisponivel } from "@/components/cliente/CalendarioAgendamento";

export function AgendaBloqueadaPercentual({ percentual, parcelasNecessarias, datas }: { percentual: number; parcelasNecessarias: number | null; datas: DataDisponivel[] }) {
  return <div className="flex flex-col gap-4">
    <section className="overflow-hidden rounded-2xl border border-rose/15 bg-white/70 p-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy"><LockKeyhole className="h-4 w-4" /></span>
        <div className="min-w-0"><p className="text-[0.55rem] font-bold uppercase tracking-[0.15em] text-rose">Minha agenda</p><h2 className="mt-1 font-heading text-sm font-semibold leading-tight text-burgundy">Atinga o percentual mínimo para liberar sua agenda</h2><p className="mt-1.5 text-[0.72rem] leading-relaxed text-clay/65">Para liberar a escolha da data, você precisa atingir <strong className="text-burgundy">{percentual}% das parcelas mínimas pagas</strong>{parcelasNecessarias ? ` (${parcelasNecessarias} parcelas)` : ""}. Assim que atingir esse percentual, iniciaremos seu levantamento financeiro.</p></div>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-rose/15 bg-white/70 p-3 opacity-75 shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-rose">Minha agenda</p><h3 className="mt-0.5 font-heading text-sm font-semibold text-burgundy dark:text-cream">Calendário bloqueado</h3></div><span className="rounded-full border border-clay/15 bg-clay/8 px-2.5 py-1 text-[0.54rem] font-bold uppercase tracking-[0.08em] text-clay/45">Aguardando percentual</span></div><div className="pointer-events-none select-none"><CalendarioAgendamento datas={datas} onConfirmar={() => {}} confirmando={false} bloqueado /></div>
    </section>
  </div>;
}
