"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileSignature, CheckCircle2, Wallet, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, nomeMes, formatarDataLonga } from "@/lib/utils";

interface CardPrevisaoLiberacaoProps {
  /** Data ISO (YYYY-MM-DD) da previsão de liberação financeira, ou null se ainda não cadastrada pela gestão. */
  previsaoLiberacaoFinanceira: string | null;
  /** Data ISO (YYYY-MM-DD) em que a cliente está/esteve agendada para assinar os termos cirúrgicos. */
  dataAssinatura: string;
  /**
   * Verdadeiro por alguns segundos logo após a etapa avançar (ex: quando a
   * previsão de liberação acaba de ser definida), pra destacar visualmente
   * o card sem precisar de um segundo elemento na tela.
   */
  destacar?: boolean;
}

type EstadoJornada = "agendada" | "assinada" | "liberacao";

/**
 * Card único da etapa "Agendar / Cirurgia" na jornada da cliente.
 *
 * Não são cards diferentes — é o MESMO componente, que muda de estado
 * conforme a cliente avança:
 *
 *   1. "agendada"  → ainda não compareceu para assinar os termos.
 *   2. "assinada"  → termos assinados, aguardando a previsão de liberação.
 *   3. "liberacao" → previsão de liberação financeira já definida.
 *
 * A transição entre estados acontece dentro do próprio card (flip),
 * substituindo o conteúdo anterior em vez de empilhar um novo elemento.
 */
export function CardPrevisaoLiberacao({
  previsaoLiberacaoFinanceira,
  dataAssinatura,
  destacar = false,
}: CardPrevisaoLiberacaoProps) {
  const hoje = new Date().toISOString().slice(0, 10);

  const estado: EstadoJornada = previsaoLiberacaoFinanceira
    ? "liberacao"
    : dataAssinatura <= hoje
    ? "assinada"
    : "agendada";

  const partesLiberacao = previsaoLiberacaoFinanceira
    ? previsaoLiberacaoFinanceira.split("-").map(Number)
    : null;
  const [anoLib, mesLib, diaLib] = partesLiberacao ?? [null, null, null];

  const CONFIG_ESTADO: Record<
    EstadoJornada,
    { titulo: string; icone: typeof FileSignature; status: string; statusTom: "gold" | "success" }
  > = {
    agendada: {
      titulo: "Assinatura dos termos",
      icone: FileSignature,
      status: "Agendada / Confirmada",
      statusTom: "gold",
    },
    assinada: {
      titulo: "✓ Termos assinados",
      icone: CheckCircle2,
      status: "Concluído",
      statusTom: "success",
    },
    liberacao: {
      titulo: "Liberação financeira",
      icone: Wallet,
      status: "Programada",
      statusTom: "success",
    },
  };

  const { titulo, icone: Icone, status, statusTom } = CONFIG_ESTADO[estado];

  return (
    <div style={{ perspective: 1200 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={estado}
          initial={{ opacity: 0, rotateY: -16, scale: 0.98 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          exit={{ opacity: 0, rotateY: 16, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <Card
            className={cn(
              "overflow-hidden p-4 transition-shadow duration-700 sm:p-5",
              destacar && "ring-2 ring-gold shadow-[0_0_0_6px_rgba(201,161,90,0.18)]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose">
                <Icone className="h-3.5 w-3.5" />
                <p className="text-[0.6rem] font-semibold uppercase tracking-label">{titulo}</p>
              </div>
              <span
                className={cn(
                  "whitespace-nowrap rounded-full px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-label",
                  statusTom === "success" && "bg-success/10 text-success",
                  statusTom === "gold" && "bg-gold/18 text-burgundy"
                )}
              >
                {status}
              </span>
            </div>

            {estado === "liberacao" && diaLib && mesLib && anoLib ? (
              <div className="mt-3.5 flex flex-col items-center text-center">
                <span className="font-heading text-4xl font-bold leading-none text-burgundy sm:text-5xl">
                  {String(diaLib).padStart(2, "0")}
                </span>
                <span className="mt-1.5 text-sm font-bold uppercase tracking-[0.18em] text-burgundy/80">
                  {nomeMes(mesLib)}
                </span>
                <span className="text-xs font-medium text-clay/50">{anoLib}</span>

                <p className="mt-3 text-[0.8rem] font-semibold text-burgundy">
                  Previsão de liberação financeira
                </p>
                <p className="mt-1 max-w-sm text-[0.7rem] leading-relaxed text-clay/55">
                  Esta é a data de liberação financeira informada a você
                  presencialmente no momento da assinatura dos termos.
                </p>
              </div>
            ) : (
              <div className="mt-3.5 flex flex-col items-center gap-1.5 text-center">
                <p className="text-[0.8rem] font-semibold text-burgundy">
                  {formatarDataLonga(dataAssinatura)}
                </p>
                {estado === "agendada" ? (
                  <p className="max-w-sm text-[0.7rem] leading-relaxed text-clay/55">
                    Compareça ao escritório para realizar a assinatura dos termos.
                  </p>
                ) : (
                  <p className="max-w-sm text-[0.7rem] leading-relaxed text-clay/55">
                    Assinatura realizada com sucesso. Em breve sua previsão de
                    liberação financeira será registrada aqui.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-blush/40 p-3">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-rose" />
              <p className="text-[0.68rem] leading-relaxed text-clay/60">
                A escolha do médico é de escolha da cliente. A Sra. Luck
                realiza a liberação financeira conforme a previsão registrada.
              </p>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
