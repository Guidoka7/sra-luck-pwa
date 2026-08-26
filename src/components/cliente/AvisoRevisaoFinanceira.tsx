"use client";

import { Clock3, ShieldCheck } from "lucide-react";

interface Props {
  status: "pendente" | "recusada" | null;
  observacao?: string | null;
}

export function AvisoRevisaoFinanceira({ status, observacao }: Props) {
  const recusada = status === "recusada";

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/20 bg-gold/[0.055] shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)]">
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          {recusada ? <ShieldCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold">
            {recusada ? "Atenção ao levantamento financeiro" : "Levantamento financeiro em andamento"}
          </p>
          <h2 className="mt-1 font-heading text-sm font-semibold leading-tight text-burgundy">
            {recusada ? "Precisamos regularizar uma divergência antes da liberação" : "Sua agenda de assinatura ainda está em análise"}
          </h2>
          <p className="mt-1.5 text-[0.72rem] leading-relaxed text-clay/65">
            {recusada
              ? "Identificamos uma divergência no levantamento. Confira a parcela/comprovante indicado pela nossa equipe, faça o pagamento ou envie novamente o comprovante correto. Depois da regularização, realizaremos um novo levantamento financeiro."
              : "Você já atingiu o percentual necessário. Agora nossa equipe está conferindo os pagamentos e os comprovantes enviados antes de liberar a agenda de assinatura dos termos."
            }
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold/15 bg-white/55 px-3 py-2.5 dark:bg-white/[0.035]">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-gold" />
            <p className="text-[0.67rem] font-semibold leading-relaxed text-burgundy">
              Prazo para o levantamento: <strong>até 5 dias úteis</strong>.
            </p>
          </div>
          {observacao && recusada && (
            <p className="mt-2 rounded-lg bg-alert/8 px-2.5 py-2 text-[0.62rem] leading-relaxed text-alert">
              {observacao}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
