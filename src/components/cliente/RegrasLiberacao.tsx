"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGRAS_LIBERACAO_AGENDA } from "@/lib/utils";

export function RegrasLiberacao({ quantidadeParcelas }: { quantidadeParcelas: number | null }) {
  const [aberto, setAberto] = useState(false);
  const regraDoContrato = REGRAS_LIBERACAO_AGENDA.find((regra) => regra.parcelas === quantidadeParcelas);
  const parcelasNecessarias = regraDoContrato
    ? Math.ceil((regraDoContrato.parcelas * regraDoContrato.percentual) / 100)
    : null;

  return (
    <div className="rounded-3xl border border-rose/15 bg-white/70 p-5 shadow-sm sm:p-6">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-burgundy/10">
            <ScrollText className="h-4 w-4 text-burgundy" />
          </span>
          <span className="text-sm font-semibold text-burgundy">
            Como funciona a liberação da sua agenda
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-none text-clay/50 transition-transform duration-200",
            aberto && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 border-t border-rose/10 pt-4">
              {regraDoContrato && parcelasNecessarias ? (
                <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-burgundy via-burgundy to-burgundy-dark p-5 text-cream shadow-card sm:p-6">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/5 blur-3xl" />

                  <p className="relative flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-label text-gold/85">
                    <span className="h-1 w-1 rounded-full bg-gold" />
                    Seu contrato
                  </p>

                  <div className="relative mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
                      <p className="font-heading text-3xl font-semibold leading-none">
                        {regraDoContrato.parcelas}
                        <span className="text-xl text-cream/60">x</span>
                      </p>
                      <p className="mt-1.5 text-[0.7rem] leading-tight text-cream/60">parcelas contratadas</p>
                    </div>
                    <div className="rounded-xl border border-gold/25 bg-gold/[0.08] px-4 py-3.5">
                      <p className="font-heading text-3xl font-semibold leading-none text-gold">
                        {regraDoContrato.percentual}
                        <span className="text-xl text-gold/70">%</span>
                      </p>
                      <p className="mt-1.5 text-[0.7rem] leading-tight text-cream/60">para liberar a agenda</p>
                    </div>
                  </div>

                  <div className="relative mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gold/20">
                      <span className="font-heading text-sm font-bold text-gold">{parcelasNecessarias}</span>
                    </span>
                    <p className="text-sm leading-snug text-cream/90">
                      Ao confirmar <strong className="font-semibold text-cream">{parcelasNecessarias} {parcelasNecessarias === 1 ? "parcela" : "parcelas"}</strong>, sua agenda poderá ser liberada.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-clay/60">As regras do seu contrato aparecerão aqui assim que as parcelas forem cadastradas.</p>
              )}

              <p className="text-sm leading-relaxed text-clay/70">
                Ao atingir o percentual necessário, faremos um levantamento
                financeiro (em até 72 horas) para confirmar seus pagamentos.
                Assim que aprovado, você poderá escolher, no calendário
                abaixo, a data da sua{" "}
                <strong className="text-burgundy">assinatura dos termos cirúrgicos</strong>.
                É nesse encontro, junto à nossa equipe, que a{" "}
                <strong className="text-burgundy">data da sua cirurgia</strong> será
                definida e informada a você.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
