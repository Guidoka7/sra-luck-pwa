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

    <section className="relative overflow-hidden rounded-2xl border border-rose/15 bg-white/70 p-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
      <div className="relative">
        <div className="pointer-events-none select-none blur-[4px] opacity-45">
          <CalendarioAgendamento datas={datas} onConfirmar={() => {}} confirmando={false} bloqueado />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
          <div className="w-full max-w-[32rem] rounded-2xl border border-gold/30 bg-white/95 p-6 text-center shadow-[0_18px_55px_-25px_rgba(82,28,42,.28)] backdrop-blur-sm dark:border-white/10 dark:bg-[#25161b]/95 sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-heading text-xl font-semibold text-burgundy dark:text-cream">Agenda indisponível por enquanto</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-clay/65 dark:text-pearl/60">Quando seus pagamentos atingirem a porcentagem necessária, você poderá escolher sua data para a assinatura dos termos.</p>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
