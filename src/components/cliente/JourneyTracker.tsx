"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Calendar, FileSignature, HeartHandshake, Sparkles, PartyPopper } from "lucide-react";
import { cn, formatarDataLonga } from "@/lib/utils";

export type JourneyStepStatus = "done" | "current" | "upcoming";
export interface JourneyStep { id: string; label: string; icon: React.ElementType; status: JourneyStepStatus; }
interface JourneyTrackerProps {
  percentualPagamento: number;
  percentualAtingido: boolean;
  statusRevisao: "pendente" | "aprovada" | "recusada" | null;
  agendada: boolean;
  previsaoLiberacaoFinanceira?: string | null;
}

type MomentoEspecial = "termos-amanha" | "termos-hoje" | "cirurgia-hoje" | null;

function dataLocalISO(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function diferencaEmDias(dataISO: string, hoje: Date): number | null {
  const partes = dataISO.split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const alvo = new Date(partes[0], partes[1] - 1, partes[2]);
  alvo.setHours(0, 0, 0, 0);
  const base = new Date(hoje);
  base.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

function formatarData(data: string | null | undefined): string {
  if (!data) return "";
  return data.split("-").reverse().join("/");
}

function CelebracaoEtapa({ momento, data, onFechar }: { momento: Exclude<MomentoEspecial, null>; data: string; onFechar: () => void }) {
  const cirurgia = momento === "cirurgia-hoje";
  const hoje = momento === "termos-hoje";
  const titulo = cirurgia
    ? "Hoje é o grande dia!"
    : hoje
      ? "Hoje é o dia da sua assinatura"
      : "Amanhã é um dia especial";
  const mensagem = cirurgia
    ? "Sua jornada chegou à conclusão. Hoje acontece a sua cirurgia e todo o processo que você percorreu até aqui se concretiza."
    : hoje
      ? "Chegou o dia da assinatura dos seus termos cirúrgicos. Estamos felizes em acompanhar você nesta etapa tão importante."
      : `Amanhã, ${formatarData(data)}, será a assinatura dos seus termos cirúrgicos. Prepare-se para esta etapa especial da sua jornada.`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-burgundy-dark/95 px-4 py-6 backdrop-blur-md sm:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className={cn("pointer-events-none absolute rounded-full", cirurgia ? "h-2.5 w-2.5 bg-gold/70" : "h-2 w-2 bg-rose/65")}
            style={{ left: `${(i * 47 + 7) % 100}%`, top: `${(i * 29 + 5) % 95}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.35, 0.6], y: [12, -18, 8] }}
            transition={{ duration: 2.8 + (i % 4) * 0.35, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}

        <motion.div
          className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-rose/25 bg-burgundy px-6 py-8 text-center shadow-[0_30px_100px_-30px_rgba(0,0,0,0.9)] sm:px-10 sm:py-10"
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.18, type: "spring", stiffness: 220, damping: 14 }}
          >
            {cirurgia ? <PartyPopper className="h-8 w-8" /> : <FileSignature className="h-8 w-8" />}
          </motion.div>

          <span className="mt-5 block text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-gold sm:text-xs">
            {cirurgia ? "Conclusão da sua jornada" : hoje ? "Chegou o dia" : "Sua próxima etapa"}
          </span>
          <h2 className="mx-auto mt-3 max-w-md font-heading text-[2rem] font-semibold leading-tight text-cream sm:text-4xl">
            {titulo}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-[0.95rem] leading-7 text-cream/75 sm:text-base">
            {mensagem}
          </p>
          <motion.div
            className="mx-auto mt-6 h-px w-20 bg-gold/50"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 80, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          />
          <button
            type="button"
            onClick={onFechar}
            className="mt-7 w-full rounded-full bg-cream px-5 py-3 text-xs font-bold uppercase tracking-label text-burgundy transition-transform hover:scale-[1.01] active:scale-[0.98]"
          >
            {cirurgia ? "Continuar" : "Ver minha jornada"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function JourneyTracker({ percentualPagamento, percentualAtingido, statusRevisao, agendada, previsaoLiberacaoFinanceira = null }: JourneyTrackerProps) {
  const agendaLiberada = statusRevisao === "aprovada";
  const revisaoPendente = statusRevisao === "pendente";
  const revisaoRecusada = statusRevisao === "recusada";
  const etapaAtual = useMemo(() => {
    if (!percentualAtingido) return "pagamento";
    if (!agendaLiberada) return "agendar";
    if (!agendada) return "agendar";
    return "cirurgia";
  }, [percentualAtingido, agendaLiberada, agendada]);
  const [etapaAberta, setEtapaAberta] = useState(etapaAtual);
  const [momentoEspecial, setMomentoEspecial] = useState<MomentoEspecial>(null);
  const [dataMomentoEspecial, setDataMomentoEspecial] = useState<string | null>(null);
  const steps: JourneyStep[] = [
    { id: "contratar", label: "Contratar", icon: FileSignature, status: "done" },
    { id: "pagamento", label: `${Math.min(100, Math.max(0, Math.round(percentualPagamento)))}% pago`, icon: HeartHandshake, status: percentualAtingido ? "done" : "current" },
    { id: "agendar", label: "Agendar", icon: Calendar, status: agendaLiberada && agendada ? "done" : etapaAtual === "agendar" ? "current" : "upcoming" },
    { id: "cirurgia", label: "Cirurgia", icon: Sparkles, status: etapaAtual === "cirurgia" ? "current" : "upcoming" },
  ];

  useEffect(() => {
    setEtapaAberta(etapaAtual);
  }, [etapaAtual]);

  useEffect(() => {
    let cancelado = false;

    async function verificarDatasEspeciais() {
      try {
        const res = await fetch("/api/cliente/agenda", { cache: "no-store" });
        if (!res.ok || cancelado) return;
        const data = await res.json();
        const agenda = data.agendamentoAtivo ?? data.agendamentoConcluido ?? null;
        if (!agenda) return;

        const hoje = new Date();
        const dataTermos = agenda.data as string | null | undefined;
        const dataLiberacao = agenda.previsaoLiberacaoFinanceira as string | null | undefined;
        const diffTermos = dataTermos ? diferencaEmDias(dataTermos, hoje) : null;
        const diffLiberacao = dataLiberacao ? diferencaEmDias(dataLiberacao, hoje) : null;

        let proximo: MomentoEspecial = null;
        let dataEvento: string | null = null;

        // A conclusão tem prioridade: no dia da liberação financeira é também o dia da cirurgia.
        if (diffLiberacao === 0) {
          proximo = "cirurgia-hoje";
          dataEvento = dataLiberacao ?? null;
        } else if (diffTermos === 0) {
          proximo = "termos-hoje";
          dataEvento = dataTermos ?? null;
        } else if (diffTermos === 1) {
          proximo = "termos-amanha";
          dataEvento = dataTermos ?? null;
        }

        if (!proximo || !dataEvento) return;

        const chave = `sra-luck-momento-especial:${proximo}:${dataEvento}`;
        if (sessionStorage.getItem(chave) === "1") return;
        sessionStorage.setItem(chave, "1");

        if (!cancelado) {
          setDataMomentoEspecial(dataEvento);
          setMomentoEspecial(proximo);
        }
      } catch {
        // A animação é complementar e não pode impedir o funcionamento da agenda.
      }
    }

    verificarDatasEspeciais();
    const intervalo = window.setInterval(verificarDatasEspeciais, 60_000);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, []);

  const etapaVisivel = steps.some((s) => s.id === etapaAberta) ? etapaAberta : etapaAtual;
  const totalSegmentos = steps.length - 1;
  const dataFormatadaLiberacao = previsaoLiberacaoFinanceira ? formatarDataLonga(previsaoLiberacaoFinanceira) : null;
  const textos: Record<string, string> = {
    contratar: "Seu contrato foi iniciado. Agora, cada pagamento confirmado faz parte da sua evolução.",
    pagamento: percentualAtingido ? "Parabéns! Você atingiu o percentual de pagamento necessário. A próxima etapa será a liberação da sua agenda." : "Cada pagamento confirmado te aproxima do percentual necessário para liberar sua agenda. Envie seus comprovantes na aba \"Meus Boletos\".",
    agendar: agendaLiberada ? agendada ? "Sua assinatura dos termos cirúrgicos foi confirmada. Agora você segue para a próxima etapa da sua jornada." : "Sua agenda está liberada para escolher a assinatura dos termos cirúrgicos." : revisaoPendente ? "Estamos realizando o levantamento financeiro dos seus pagamentos. Sua agenda será liberada após a confirmação." : revisaoRecusada ? "Encontramos uma divergência no levantamento financeiro. Fale com a nossa equipe para regularizar." : "Esta etapa será liberada quando seu percentual de pagamento for atingido.",
    cirurgia: agendada ? dataFormatadaLiberacao ? `Sua assinatura está confirmada. Você poderá agendar sua cirurgia a partir da data prevista para liberação financeira: ${dataFormatadaLiberacao}.` : "Sua assinatura está confirmada. A data prevista para liberação financeira será informada pela equipe." : "A cirurgia é a próxima conquista depois da assinatura dos termos.",
  };
  const indiceAtual = Math.max(0, steps.findIndex((s) => s.id === etapaAtual));
  const fillPercent = totalSegmentos === 0 ? 0 : (indiceAtual / totalSegmentos) * 100 + (steps[indiceAtual]?.status === "current" ? 8 : 0);
  function preenchimentoDoSegmento(indice: number): number { const fracaoGlobal = fillPercent / 100; const fracaoDoSegmento = fracaoGlobal * totalSegmentos - indice; return Math.min(100, Math.max(0, fracaoDoSegmento * 100)); }

  return <>
    {momentoEspecial && dataMomentoEspecial && <CelebracaoEtapa momento={momentoEspecial} data={dataMomentoEspecial} onFechar={() => setMomentoEspecial(null)} />}
    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white via-blush/30 to-white p-3.5 shadow-card sm:p-4 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#202225] dark:via-[#181a1d] dark:to-[#111315] dark:shadow-[0_24px_70px_-38px_rgba(0,0,0,0.92),0_1px_0_rgba(255,255,255,0.035)_inset]">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gold/10 blur-2xl" />
      <div className="relative mb-3 flex items-baseline justify-between gap-3"><h2 className="font-heading text-[0.8rem] font-semibold text-burgundy sm:text-sm dark:text-[#F4D9DC]">Sua jornada até a cirurgia</h2><span className="text-[0.6rem] font-semibold uppercase tracking-label text-clay/40 dark:text-[#D9C8CB]/55">{etapaAtual === "cirurgia" ? "Próxima etapa" : etapaAtual === "agendar" ? "Etapa atual" : "Em andamento"}</span></div>
      <div className="relative mx-auto flex max-w-sm items-start justify-center sm:max-w-md">{steps.map((step, indice) => <Fragment key={step.id}>{step.id === "agendar" && !percentualAtingido ? <div aria-disabled="true" className="relative z-10 flex flex-none cursor-not-allowed flex-col items-center gap-1 text-center opacity-70"><div className={cn("relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-200 sm:h-9 sm:w-9 dark:bg-[#24272A]", step.status === "done" && "border-burgundy bg-gradient-to-br from-burgundy to-burgundy-light text-cream", step.status === "current" && "border-gold text-burgundy shadow-[0_0_0_4px_rgba(201,161,90,0.22)]", step.status === "upcoming" && "border-clay/15 text-clay/30 dark:border-white/10 dark:text-[#B8B0B3]/35")}>{step.status === "done" ? <><span className="absolute inset-1 rounded-full border border-gold/45" /><Check className="relative h-4 w-4 stroke-[3]" /></> : <step.icon className="h-3.5 w-3.5" />}</div><span className="w-14 text-[0.56rem] font-bold uppercase leading-tight tracking-wide text-clay/45 sm:w-16 dark:text-[#D9C8CB]/45">{step.label}</span></div> : <button type="button" onClick={() => setEtapaAberta(step.id)} aria-pressed={etapaVisivel === step.id} className="relative z-10 flex flex-none flex-col items-center gap-1 text-center outline-none"><div className={cn("relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-200 active:scale-95 sm:h-9 sm:w-9 dark:bg-[#24272A]", step.status === "done" && "border-burgundy bg-gradient-to-br from-burgundy to-burgundy-light text-cream shadow-[0_10px_22px_-10px_rgba(122,38,50,0.9)]", step.status === "current" && "border-gold text-burgundy shadow-[0_0_0_4px_rgba(201,161,90,0.22)]", step.status === "upcoming" && "border-clay/15 text-clay/30 dark:border-white/10 dark:text-[#B8B0B3]/35", etapaAtual === step.id && "ring-2 ring-gold/30")}>{step.status === "done" ? <><span className="absolute inset-1 rounded-full border border-gold/45" /><Check className="relative h-4 w-4 stroke-[3]" /></> : <step.icon className="h-3.5 w-3.5" />}</div><span className={cn("w-14 text-[0.56rem] font-bold uppercase leading-tight tracking-wide text-clay/45 sm:w-16 dark:text-[#D9C8CB]/45", step.id === etapaAtual && "text-burgundy/90 dark:text-[#F0DDE0]/90")}>{step.label}</span></button>}{indice < steps.length - 1 && <div className="flex h-8 flex-1 items-center px-1 sm:h-9"><div className="relative h-[2px] w-full overflow-hidden rounded-full"><div className="absolute inset-0 rounded-full" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(173,104,107,0.28) 0 6px, transparent 6px 12px)" }} /><motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-burgundy to-gold" initial={{ width: 0 }} animate={{ width: `${preenchimentoDoSegmento(indice)}%` }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} /></div></div>}</Fragment>)}</div>
      <AnimatePresence initial={false} mode="sync"><motion.p key={etapaVisivel} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.14, ease: "easeOut" }} className="relative mt-3 rounded-xl bg-bloom/70 px-3.5 py-2.5 text-center text-[0.72rem] leading-relaxed text-clay/65 dark:border dark:border-white/[0.06] dark:bg-white/[0.045] dark:text-[#D8D0D2]/70">{textos[etapaVisivel]}</motion.p></AnimatePresence>
    </div>
  </>;
}
