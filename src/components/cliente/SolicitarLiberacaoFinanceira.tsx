"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CreditCard, FileCheck2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { ativo?: boolean; }
type FormaCusteio = "cartao" | "pix" | "cheques" | "boleto_100";
interface Financeiro { saldoRestante: number | null; taxaCartao: number; totalComTaxa: number | null; formasCusteio: string[]; }
interface Solicitacao { id: string; forma_custeio: FormaCusteio; saldo_restante: number; taxa_cartao: number; total_com_taxa: number; status: string; observacao: string | null; }

function formatarMoeda(valor: number) { return valor.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
function dataLocalISO(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
const TEST_CLOCK_KEY = "sra-luck-test-date";
function hojeDaAplicacao() {
  if (typeof window !== "undefined") {
    const teste = window.localStorage.getItem(TEST_CLOCK_KEY);
    if (teste && /^\d{4}-\d{2}-\d{2}$/.test(teste)) return teste;
  }
  return dataLocalISO(new Date());
}
function diferencaEmDias(dataISO: string, hojeISO: string) {
  const [y,m,d] = dataISO.split("-").map(Number); const [hy,hm,hd] = hojeISO.split("-").map(Number);
  if (![y,m,d,hy,hm,hd].every(Number.isFinite)) return null;
  return Math.round((Date.UTC(y,m-1,d)-Date.UTC(hy,hm-1,hd))/86400000);
}
const FORMAS: Array<{ id: FormaCusteio; titulo: string; descricao: string }> = [
  { id:"cartao", titulo:"Cartão de crédito", descricao:"taxa configurada no contrato" },
  { id:"pix", titulo:"PIX", descricao:"sem taxa adicional" },
  { id:"cheques", titulo:"Cheques", descricao:"análise de até 5 dias úteis" },
  { id:"boleto_100", titulo:"100% boleto", descricao:"análise de até 5 dias úteis" },
];

export function SolicitarLiberacaoFinanceira({ ativo = true }: Props) {
  const [financeiro,setFinanceiro] = useState<Financeiro>({ saldoRestante:null, taxaCartao:5.4, totalComTaxa:null, formasCusteio:[] });
  const [solicitacao,setSolicitacao] = useState<Solicitacao|null>(null);
  const [dataAssinaturaTermos,setDataAssinaturaTermos] = useState<string|null>(null);
  const [hoje,setHoje] = useState(hojeDaAplicacao);
  const [modalAberto,setModalAberto] = useState(false);
  const [formaCusteio,setFormaCusteio] = useState<FormaCusteio|null>(null);
  const [enviando,setEnviando] = useState(false);
  const [erro,setErro] = useState<string|null>(null);

  useEffect(() => {
    if (!ativo) return;
    let montado = true;
    async function carregar() {
      try {
        const [financeiroRes, agendaRes] = await Promise.all([
          fetch("/api/cliente/solicitacao-liberacao-financeira", { cache:"no-store" }),
          fetch("/api/cliente/agenda", { cache:"no-store" }),
        ]);
        if (!montado) return;
        if (financeiroRes.ok) {
          const data = await financeiroRes.json();
          setFinanceiro(data.financeiro ?? { saldoRestante:null, taxaCartao:5.4, totalComTaxa:null, formasCusteio:[] });
          setSolicitacao(data.solicitacao ?? null);
        }
        if (agendaRes.ok) {
          const data = await agendaRes.json();
          const agenda = data.agendamentoAtivo ?? data.agendamentoConcluido ?? null;
          setDataAssinaturaTermos(agenda?.data ?? null);
        }
        setHoje(hojeDaAplicacao());
      } catch {}
    }
    void carregar();
    const intervalo = setInterval(() => void carregar(), 5000);
    return () => { montado = false; clearInterval(intervalo); };
  }, [ativo]);

  const saldoRestante = Number(financeiro.saldoRestante ?? 0);
  const taxaCartao = saldoRestante * (Number(financeiro.taxaCartao ?? 5.4) / 100);
  const totalCartao = financeiro.totalComTaxa ?? saldoRestante + taxaCartao;
  const formasDisponiveis = useMemo(() => FORMAS.filter(forma => financeiro.formasCusteio.includes(forma.id)), [financeiro.formasCusteio]);

  function abrirModal() { setErro(null); setFormaCusteio(solicitacao?.forma_custeio ?? null); setModalAberto(true); }

  async function enviar() {
    if (!formaCusteio) return;
    setEnviando(true); setErro(null);
    try {
      const res = await fetch("/api/cliente/solicitacao-liberacao-financeira", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ formaCusteio }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível enviar sua solicitação.");
      setSolicitacao(data.solicitacao ?? null); setModalAberto(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar sua solicitação."); }
    finally { setEnviando(false); }
  }

  if (!ativo) return null;
  const status = String(solicitacao?.status ?? "").toLowerCase();
  const recusada = status.includes("recus");
  const aprovada = status.includes("aprov");
  const diasParaAssinatura = dataAssinaturaTermos ? diferencaEmDias(dataAssinaturaTermos, hoje) : null;
  const ocultarPagamentoConfirmado = aprovada && diasParaAssinatura !== null && diasParaAssinatura <= 0;
  const statusTitulo = recusada ? "Solicitação recusada" : aprovada ? "Pagamento confirmado" : "Aguardando validação";
  const statusDescricao = recusada
    ? solicitacao?.observacao ?? "Nossa equipe registrou uma observação sobre a solicitação."
    : aprovada
      ? "O valor restante do seu contrato deverá ser pago no dia da assinatura dos termos."
      : "Sua escolha foi registrada e está em análise pela equipe financeira.";

  return <>
    {!ocultarPagamentoConfirmado && <section className={cn("mb-4 overflow-hidden rounded-2xl border shadow-[0_14px_40px_-28px_rgba(0,0,0,.35)]", recusada ? "border-alert/15 bg-alert/[0.045]" : "border-success/15 bg-success/[0.045]")}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", recusada ? "bg-alert/10 text-alert" : "bg-success/10 text-success")}>
          {solicitacao ? <CheckCircle2 className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[0.58rem] font-semibold uppercase tracking-[0.14em]", recusada ? "text-alert" : "text-success")}>{solicitacao ? statusTitulo : "Liberação financeira"}</p>
          <p className="mt-0.5 text-[0.68rem] leading-[1.35] text-clay/60">{solicitacao ? statusDescricao : "Informe como será realizado o pagamento do saldo restante."}</p>
        </div>
        {solicitacao && <span className={cn("hidden shrink-0 rounded-lg border px-2.5 py-1.5 text-[0.56rem] font-bold uppercase tracking-[0.1em] sm:inline-flex", aprovada ? "border-success/15 bg-success/10 text-success" : recusada ? "border-alert/15 bg-alert/10 text-alert" : "border-rose/15 bg-rose/10 text-rose")}>{aprovada ? "Pagamento confirmado" : recusada ? "Recusado" : "Em análise"}</span>}
        {!solicitacao && <button type="button" onClick={abrirModal} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-burgundy px-2.5 py-2 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-cream shadow-card transition hover:bg-burgundy-dark sm:px-3 sm:text-[0.6rem]"><CreditCard className="h-3.5 w-3.5" /><span>SOLICITAR</span></button>}
      </div>
    </section>}

    <AnimatePresence>
      {modalAberto && <motion.div className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget&&!enviando)setModalAberto(false)}}>
        <motion.div role="dialog" aria-modal="true" aria-labelledby="solicitar-liberacao-titulo" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.98}} transition={{duration:.2}} className="my-auto w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-rose/15 bg-white p-4 text-clay shadow-2xl dark:border-white/10 dark:bg-[#171618] dark:text-white sm:max-h-[calc(100dvh-2rem)] sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[0.6rem] font-semibold uppercase tracking-label text-rose dark:text-rose">Liberação financeira</p><h2 id="solicitar-liberacao-titulo" className="mt-1 font-heading text-base font-semibold text-burgundy dark:text-cream">Escolha a forma de pagamento do valor restante</h2></div><button type="button" onClick={()=>!enviando&&setModalAberto(false)} className="rounded-full p-1.5 text-clay/50 transition hover:bg-blush hover:text-burgundy dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button></div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-blush/45 p-3 dark:bg-white/[0.045]"><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45 dark:text-white/45">Saldo restante</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(saldoRestante)}</p></div><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45 dark:text-white/45">Cartão com taxa</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(totalCartao)}</p></div></div>
          <div className="mt-3 grid gap-2">{formasDisponiveis.map(forma=><button key={forma.id} type="button" onClick={()=>setFormaCusteio(forma.id)} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition",formaCusteio===forma.id?"border-burgundy bg-burgundy text-cream":"border-rose/15 bg-white text-clay/70 hover:border-rose dark:border-white/10 dark:bg-white/[0.035] dark:text-white/75 dark:hover:border-rose/40")}><span className="min-w-0"><span className={cn("block text-[0.72rem] font-semibold",formaCusteio===forma.id?"text-cream":"text-burgundy dark:text-white")}>{forma.titulo}</span><span className={cn("block text-[0.6rem]",formaCusteio===forma.id?"text-cream/70":"text-clay/50 dark:text-white/50")}>{forma.descricao}</span></span><span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border",formaCusteio===forma.id?"border-cream bg-cream":"border-clay/25 dark:border-white/25")} /></button>)}</div>
          {formasDisponiveis.length===0&&<p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">Nenhuma forma de pagamento está disponível para este contrato no momento.</p>}
          {erro&&<p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">{erro}</p>}
          <button type="button" onClick={enviar} disabled={!formaCusteio||enviando||formasDisponiveis.length===0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-3 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-cream transition hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-45">{enviando ? "Enviando..." : "Confirmar e solicitar liberação"}</button>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  </>;
}
