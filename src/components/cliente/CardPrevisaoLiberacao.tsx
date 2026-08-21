"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, CheckCircle2, FileSignature, Info, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, formatarDataLonga, nomeMes } from "@/lib/utils";

interface CardPrevisaoLiberacaoProps {
  previsaoLiberacaoFinanceira: string | null;
  dataAssinatura: string;
  destacar?: boolean;
}
type EstadoJornada = "agendada" | "assinada" | "liberacao";
function dataParts(iso: string | null) { if (!iso) return null; const [ano, mes, dia] = iso.split("-").map(Number); return ano && mes && dia ? { ano, mes, dia } : null; }

export function CardPrevisaoLiberacao({ previsaoLiberacaoFinanceira, dataAssinatura, destacar = false }: CardPrevisaoLiberacaoProps) {
  const hoje = new Date().toISOString().slice(0, 10);
  const assinatura = dataParts(dataAssinatura);
  const liberacao = dataParts(previsaoLiberacaoFinanceira);
  const antesDaAssinatura = Boolean(previsaoLiberacaoFinanceira && dataAssinatura > hoje);
  const estado: EstadoJornada = antesDaAssinatura
    ? "agendada"
    : dataAssinatura <= hoje && previsaoLiberacaoFinanceira
    ? "liberacao"
    : dataAssinatura <= hoje
    ? "assinada"
    : "agendada";
  const CONFIG: Record<EstadoJornada, { titulo: string; icone: typeof FileSignature; status: string; tom: "gold" | "success" }> = {
    agendada: { titulo: "Próximas datas", icone: CalendarDays, status: "Agendada / Confirmada", tom: "gold" },
    assinada: { titulo: "✓ Termos assinados", icone: CheckCircle2, status: "Concluído", tom: "success" },
    liberacao: { titulo: "Liberação financeira", icone: Wallet, status: "Programada", tom: "success" },
  };
  const { titulo, icone: Icone, status, tom } = CONFIG[estado];

  return <div style={{ perspective: 1200 }}><AnimatePresence mode="wait"><motion.div key={`${estado}-${previsaoLiberacaoFinanceira ?? "sem-previsao"}`} initial={{ opacity: 0, rotateY: -16, scale: 0.98 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} exit={{ opacity: 0, rotateY: 16, scale: 0.98 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ transformStyle: "preserve-3d" }}>
    <Card className={cn("overflow-hidden p-4 transition-shadow duration-700 sm:p-5", destacar && "ring-2 ring-gold shadow-[0_0_0_6px_rgba(201,161,90,0.18)]")}>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-rose"><Icone className="h-3.5 w-3.5" /><p className="text-[0.6rem] font-semibold uppercase tracking-label">{titulo}</p></div><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-label", tom === "success" ? "bg-success/10 text-success" : "bg-gold/18 text-burgundy")}>{status}</span></div>

      {antesDaAssinatura && assinatura && liberacao ? <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-rose/12 bg-blush/45 p-3 text-center"><p className="text-[0.58rem] font-bold uppercase tracking-label text-clay/45">Assinatura dos termos</p><p className="mt-2 font-heading text-2xl font-bold leading-none text-burgundy">{String(assinatura.dia).padStart(2,"0")}</p><p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-burgundy/75">{nomeMes(assinatura.mes)}</p><p className="text-[0.62rem] text-clay/45">{assinatura.ano}</p></div>
          <div className="rounded-2xl border border-gold/25 bg-gold/[0.08] p-3 text-center"><p className="text-[0.58rem] font-bold uppercase tracking-label text-clay/45">Liberação financeira</p><p className="mt-2 font-heading text-2xl font-bold leading-none text-burgundy">{String(liberacao.dia).padStart(2,"0")}</p><p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-burgundy/75">{nomeMes(liberacao.mes)}</p><p className="text-[0.62rem] text-clay/45">{liberacao.ano}</p></div>
        </div>
        <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-clay/55">No ato da assinatura dos termos cirúrgicos, o custeio do valor restante deverá ser realizado conforme a modalidade escolhida.</p>
      </> : estado === "liberacao" && liberacao ? <div className="mt-3.5 flex flex-col items-center text-center"><span className="font-heading text-4xl font-bold leading-none text-burgundy sm:text-5xl">{String(liberacao.dia).padStart(2,"0")}</span><span className="mt-1.5 text-sm font-bold uppercase tracking-[0.18em] text-burgundy/80">{nomeMes(liberacao.mes)}</span><span className="text-xs font-medium text-clay/50">{liberacao.ano}</span><p className="mt-3 text-[0.8rem] font-semibold text-burgundy">Previsão de liberação financeira</p><p className="mt-1 max-w-sm text-[0.7rem] leading-relaxed text-clay/55">Esta é a data registrada pela nossa equipe para a liberação financeira.</p></div> : <div className="mt-3.5 flex flex-col items-center gap-1.5 text-center"><p className="text-[0.8rem] font-semibold text-burgundy">{formatarDataLonga(dataAssinatura)}</p><p className="max-w-sm text-[0.7rem] leading-relaxed text-clay/55">Compareça ao escritório para realizar a assinatura dos termos. Assim que a previsão financeira for definida, ela aparecerá aqui.</p></div>}

      <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-blush/40 p-3"><Info className="mt-0.5 h-3.5 w-3.5 flex-none text-rose" /><p className="text-[0.68rem] leading-relaxed text-clay/60">A escolha do médico é totalmente livre e fica a critério da cliente. A Sra. Luck realiza a liberação financeira conforme a previsão registrada.</p></div>
    </Card>
  </motion.div></AnimatePresence></div>;
}
