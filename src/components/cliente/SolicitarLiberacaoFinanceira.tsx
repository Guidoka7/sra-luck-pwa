"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CreditCard, LockKeyhole, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarioCirurgia } from "@/components/cliente/CalendarioCirurgia";

interface Props { ativo?: boolean; }
type FormaCusteio = "cartao" | "pix" | "cheques" | "boleto_100";
interface Financeiro { saldoRestante: number | null; taxaCartao: number; totalComTaxa: number | null; formasCusteio: string[]; }
interface Solicitacao { id: string; forma_custeio: FormaCusteio; saldo_restante: number; taxa_cartao: number; total_com_taxa: number; status: string; observacao: string | null; }
function formatarMoeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function SolicitarLiberacaoFinanceira({ ativo = true }: Props) {
  const [financeiro, setFinanceiro] = useState<Financeiro>({ saldoRestante: null, taxaCartao: 5.4, totalComTaxa: null, formasCusteio: [] });
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [dataAssinaturaTermos, setDataAssinaturaTermos] = useState<string | null>(null);
  const [dataCirurgia, setDataCirurgia] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [formaCusteio, setFormaCusteio] = useState<FormaCusteio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let montado = true;
    async function carregar() {
      try {
        const res = await fetch("/api/cliente/agenda", { cache: "no-store" });
        if (!res.ok || !montado) return;
        const data = await res.json();
        setFinanceiro(data.financeiro ?? { saldoRestante: null, taxaCartao: 5.4, totalComTaxa: null, formasCusteio: [] });
        setSolicitacao(data.solicitacaoLiberacaoFinanceira ?? null);
        const agenda = data.agendamentoAtivo ?? data.agendamentoConcluido ?? null;
        setDataAssinaturaTermos(agenda?.data ?? null);
        setDataCirurgia(agenda?.previsaoLiberacaoFinanceira ?? null);
      } catch {}
    }
    void carregar();
    const intervalo = setInterval(() => void carregar(), 5000);
    return () => { montado = false; clearInterval(intervalo); };
  }, [ativo]);

  const saldoRestante = Number(financeiro.saldoRestante ?? 0);
  const taxaCartao = saldoRestante * (Number(financeiro.taxaCartao ?? 5.4) / 100);
  const totalCartao = financeiro.totalComTaxa ?? saldoRestante + taxaCartao;
  const formasDisponiveis = useMemo(() => ["cartao", "pix", "cheques", "boleto_100"].filter(f => financeiro.formasCusteio.includes(f)) as FormaCusteio[], [financeiro.formasCusteio]);
  const status = String(solicitacao?.status ?? "").toLowerCase();
  const recusada = status.includes("recus");
  const aprovada = status.includes("aprov");
  function abrirModal() { setErro(null); setFormaCusteio(solicitacao?.forma_custeio ?? null); setModalAberto(true); }
  async function enviar() {
    if (!formaCusteio) return;
    setEnviando(true); setErro(null);
    try {
      const res = await fetch("/api/cliente/solicitacao-liberacao-financeira", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formaCusteio }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível enviar sua solicitação.");
      setSolicitacao(data.solicitacao ?? null); setModalAberto(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar sua solicitação."); }
    finally { setEnviando(false); }
  }
  if (!ativo) return null;
  return <div className="flex flex-col gap-4">
    <section className={cn("overflow-hidden rounded-2xl border shadow-[0_14px_40px_-28px_rgba(0,0,0,.35)]", recusada ? "border-alert/15 bg-alert/[0.045]" : "border-success/15 bg-success/[0.045]")}>
      <div className="flex items-center gap-2.5 px-3 py-3 sm:px-3.5 sm:py-3.5"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", recusada ? "bg-alert/10 text-alert" : "bg-success/10 text-success")}><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className={cn("text-[0.58rem] font-semibold uppercase tracking-[0.14em]", recusada ? "text-alert" : "text-success")}>Financeiro confirmado</p><h3 className="mt-0.5 font-heading text-sm font-semibold leading-tight text-burgundy">Agora escolha a data da sua cirurgia</h3><p className="mt-0.5 text-[0.62rem] leading-[1.4] text-clay/55">A data da assinatura dos termos já foi escolhida. Para escolher a data da cirurgia, informe como será realizado o pagamento do saldo restante.</p></div>{!solicitacao && <button type="button" onClick={abrirModal} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-rose px-2.5 py-2 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-white shadow-card transition hover:opacity-90"><CreditCard className="h-3 w-3" /> Informar custeio</button>}{solicitacao && <span className={cn("hidden shrink-0 rounded-lg border px-2.5 py-1.5 text-[0.54rem] font-bold uppercase tracking-[0.08em] sm:inline-flex", recusada ? "border-alert/15 bg-alert/10 text-alert" : "border-success/15 bg-success/10 text-success")}>{recusada ? "Revisar custeio" : aprovada ? "Custeio confirmado" : "Custeio enviado"}</span>}</div>
    </section>

    {dataAssinaturaTermos && !solicitacao && !dataCirurgia && <section className="overflow-hidden rounded-2xl border border-rose/15 bg-white/70 opacity-75 shadow-[0_14px_40px_-28px_rgba(0,0,0,.35)] dark:border-white/10 dark:bg-white/[0.035]"><div className="flex items-center gap-2.5 border-b border-rose/10 bg-blush/25 px-3 py-3 sm:px-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold"><LockKeyhole className="h-4 w-4" /></span><div><p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-gold">Segunda agenda</p><h3 className="mt-0.5 font-heading text-sm font-semibold text-burgundy dark:text-cream">Agenda da cirurgia bloqueada</h3><p className="mt-0.5 text-[0.62rem] leading-relaxed text-clay/55">Escolha primeiro a forma de custeio do valor restante. Depois disso, esta agenda será liberada para seleção.</p></div></div><div className="pointer-events-none select-none p-3 sm:p-4"><CalendarioCirurgia dataAssinatura={dataAssinaturaTermos} onConfirmada={() => {}} /></div></section>}
    {solicitacao && dataAssinaturaTermos && !dataCirurgia && <CalendarioCirurgia dataAssinatura={dataAssinaturaTermos} onConfirmada={setDataCirurgia} />}
    <AnimatePresence>{modalAberto && <motion.div className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget && !enviando) setModalAberto(false); }}><motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} className="my-auto w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-rose/15 bg-white p-4 text-clay shadow-2xl dark:border-white/10 dark:bg-[#171618] dark:text-white sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[0.6rem] font-semibold uppercase tracking-label text-rose">Custeio do valor restante</p><h2 className="mt-1 font-heading text-base font-semibold text-burgundy dark:text-cream">Informe como será realizado o pagamento</h2></div><button type="button" onClick={() => !enviando && setModalAberto(false)} className="rounded-full p-1.5 text-clay/50 hover:bg-blush dark:text-white/50 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-blush/45 p-3 dark:bg-white/[0.045]"><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Saldo restante</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(saldoRestante)}</p></div><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Cartão com taxa</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(totalCartao)}</p></div></div><div className="mt-3 grid gap-2">{formasDisponiveis.map(forma => { const titulo = forma === "cartao" ? "Cartão de crédito" : forma === "pix" ? "PIX" : forma === "cheques" ? "Cheques" : "100% boleto"; const descricao = forma === "cartao" ? "taxa configurada no contrato" : forma === "pix" ? "sem taxa adicional" : "análise de até 5 dias úteis"; return <button key={forma} type="button" onClick={() => setFormaCusteio(forma)} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition", formaCusteio === forma ? "border-burgundy bg-burgundy text-cream" : "border-rose/15 bg-white text-clay/70 hover:border-rose dark:border-white/10 dark:bg-white/[0.035] dark:text-white/75")}><span><span className="block text-[0.72rem] font-semibold">{titulo}</span><span className="block text-[0.6rem] opacity-60">{descricao}</span></span><span className={cn("h-3.5 w-3.5 rounded-full border", formaCusteio === forma ? "border-cream bg-cream" : "border-clay/25")} /></button>; })}</div>{formasDisponiveis.length === 0 && <p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">Nenhuma forma de custeio está disponível para este contrato no momento.</p>}{erro && <p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">{erro}</p>}<button type="button" onClick={enviar} disabled={!formaCusteio || enviando || formasDisponiveis.length === 0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-3 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-cream transition hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-45">{enviando ? "Enviando..." : "Confirmar custeio e liberar agenda"}</button></motion.div></motion.div>}</AnimatePresence>
  </div>;
}
