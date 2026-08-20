"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Fragment, useState } from "react";
import { Check, Calendar, FileSignature, HeartHandshake, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type JourneyStepStatus = "done" | "current" | "upcoming";

export interface JourneyStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: JourneyStepStatus;
}

interface JourneyTrackerProps {
  /** 0–100. Usado para preencher a linha entre "Pagamento" e "Agendar". */
  percentualPagamento: number;
  /** Cliente já atingiu o % de pagamento necessário (independente da revisão do admin). */
  percentualAtingido: boolean;
  /** null = ainda não atingiu o %; "pendente" = em revisão; "aprovada"/"recusada" = decisão do admin. */
  statusRevisao: "pendente" | "aprovada" | "recusada" | null;
  agendada: boolean;
}

export function JourneyTracker({
  percentualPagamento,
  percentualAtingido,
  statusRevisao,
  agendada,
}: JourneyTrackerProps) {
  const agendaLiberada = statusRevisao === "aprovada";
  const [etapaAberta, setEtapaAberta] = useState("pagamento");
  const steps: JourneyStep[] = [
    { id: "contratar", label: "Contratar", icon: FileSignature, status: "done" },
    {
      id: "pagamento",
      label: `${Math.min(100, Math.max(0, Math.round(percentualPagamento)))}% pago`,
      icon: HeartHandshake,
      status: percentualAtingido ? "done" : "current",
    },
    {
      id: "agendar",
      label: "Agendar",
      icon: Calendar,
      status: agendada ? "done" : agendaLiberada ? "current" : "upcoming",
    },
    {
      id: "cirurgia",
      label: "Cirurgia",
      icon: Sparkles,
      status: agendada ? "current" : "upcoming",
    },
  ];

  const doneCount = steps.filter((s) => s.status === "done").length;
  const totalSegmentos = steps.length - 1;
  const textos: Record<string, string> = {
    contratar: "Seu contrato foi iniciado. Agora, cada pagamento confirmado faz parte da sua evolução.",
    pagamento: percentualAtingido
      ? "Parabéns! Você atingiu o percentual de pagamento necessário."
      : "Cada pagamento confirmado te aproxima do percentual necessário para liberar sua agenda. Envie seus comprovantes na aba \"Meus Boletos\".",
    agendar: agendaLiberada
      ? "Sua agenda está liberada para escolher a assinatura dos termos cirúrgicos."
      : statusRevisao === "pendente"
      ? "Estamos realizando o levantamento financeiro dos seus pagamentos. Sua agenda será liberada em até 72 horas."
      : statusRevisao === "recusada"
      ? "Encontramos uma divergência no levantamento financeiro. Fale com a nossa equipe para regularizar."
      : "Esta etapa será liberada quando seu percentual de pagamento for atingido.",
    cirurgia: agendada ? "Sua assinatura está confirmada. Em breve, a equipe definirá sua data de cirurgia." : "A cirurgia é a próxima conquista depois da assinatura dos termos.",
  };
  // Preenche até o meio do passo "current" pra dar sensação de progresso contínuo.
  const fillPercent = Math.min(100, (doneCount / totalSegmentos) * 100 + (agendaLiberada && !agendada ? 12 : 0));

  // Distribui esse progresso geral entre os segmentos individuais (um por
  // trecho entre dois passos), pra cada pedaço da trilha encher na proporção
  // certa — sem depender de posições fixas em % que desalinham em telas
  // diferentes.
  function preenchimentoDoSegmento(indice: number): number {
    const fracaoGlobal = fillPercent / 100;
    const fracaoDoSegmento = fracaoGlobal * totalSegmentos - indice;
    return Math.min(100, Math.max(0, fracaoDoSegmento * 100));
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-blush/30 to-white p-5 shadow-card sm:p-6 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#202225] dark:via-[#181a1d] dark:to-[#111315] dark:shadow-[0_24px_70px_-38px_rgba(0,0,0,0.92),0_1px_0_rgba(255,255,255,0.035)_inset]">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gold/10 blur-2xl" />

      <div className="relative mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold text-burgundy sm:text-base dark:text-[#F4D9DC]">
          Sua jornada até a cirurgia
        </h2>
        <span className="text-[0.68rem] font-semibold uppercase tracking-label text-clay/40 dark:text-[#D9C8CB]/55">
          {agendada
            ? "Concluída"
            : agendaLiberada
            ? "Agenda liberada"
            : statusRevisao === "pendente"
            ? "Em revisão financeira"
            : statusRevisao === "recusada"
            ? "Revisão recusada"
            : "Em andamento"}
        </span>
      </div>

      <div className="relative mx-auto flex max-w-sm items-start justify-center sm:max-w-md">
        {steps.map((step, indice) => (
          <Fragment key={step.id}>
            <button
              type="button"
              onClick={() => setEtapaAberta(step.id)}
              aria-pressed={etapaAberta === step.id}
              className="relative z-10 flex flex-none flex-col items-center gap-2 text-center outline-none"
            >
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white transition-all duration-300 active:scale-95 sm:h-11 sm:w-11 dark:bg-[#24272A]",
                  step.status === "done" &&
                    "border-burgundy bg-gradient-to-br from-burgundy to-burgundy-light text-cream shadow-[0_10px_22px_-10px_rgba(122,38,50,0.9)]",
                  step.status === "current" &&
                    "border-gold text-burgundy shadow-[0_0_0_5px_rgba(201,161,90,0.22)] dark:text-[#E8C979] dark:shadow-[0_0_0_5px_rgba(201,161,90,0.12)]",
                  step.status === "upcoming" && "border-clay/15 text-clay/30 dark:border-white/10 dark:text-[#B8B0B3]/35",
                  etapaAberta === step.id && "-translate-y-1 shadow-card"
                )}
              >
                {step.status === "done" ? (
                  <>
                    <span className="absolute inset-1 rounded-full border border-gold/45" aria-hidden="true" />
                    <Check className="relative h-5 w-5 stroke-[3]" aria-label="Etapa concluída" />
                  </>
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "w-16 text-[0.62rem] font-bold uppercase leading-tight tracking-wide text-clay/45 sm:w-20 dark:text-[#D9C8CB]/45",
                  (step.status === "done" || step.status === "current") && "text-burgundy/85 dark:text-[#F0DDE0]/90"
                )}
              >
                {step.label}
              </span>
            </button>

            {/* Segmento da trilha entre este passo e o próximo. A altura
                bate exatamente com a do círculo (h-10 / sm:h-11), então a
                linha fica centralizada nele em qualquer largura de tela —
                sem depender de posições fixas em px ou %. */}
            {indice < steps.length - 1 && (
              <div className="flex h-10 flex-1 items-center px-1 sm:h-11 sm:px-2">
                <div className="relative h-[2px] w-full overflow-hidden rounded-full">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, rgba(173,104,107,0.28) 0 6px, transparent 6px 12px)",
                    }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-burgundy to-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${preenchimentoDoSegmento(indice)}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: indice * 0.08 }}
                  />
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={etapaAberta}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="relative mt-5 rounded-2xl bg-bloom/70 px-4 py-3 text-center text-xs leading-relaxed text-clay/65 dark:border dark:border-white/[0.06] dark:bg-white/[0.045] dark:text-[#D8D0D2]/70"
        >
          {textos[etapaAberta]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
