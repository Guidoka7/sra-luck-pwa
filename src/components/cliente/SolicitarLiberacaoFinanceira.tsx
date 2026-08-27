"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, CreditCard, LockKeyhole, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarioAgendamento, DataDisponivel } from "@/components/cliente/CalendarioAgendamento";
import { CalendarioCirurgia } from "@/components/cliente/CalendarioCirurgia";

interface Props { ativo?: boolean; }
type FormaCusteio = "cartao" | "pix" | "cheques" | "boleto_100";
interface Financeiro { saldoRestante: number | null; taxaCartao: number; totalComTaxa: number | null; formasCusteio: string[]; }
interface Solicitacao { id: string; forma_custeio: FormaCusteio; saldo_restante: number; taxa_cartao: number; total_com_taxa: number; status: string; observacao: string | null; }
function formatarMoeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatarData(iso: string) { return iso.split("-").reverse().join("/"); }
function partesData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return { dia, mes: meses[Math.max(0, Number(mes) - 1)] ?? mes, ano };
}

export function SolicitarLiberacaoFinanceira({ ativo = true }: Props) {
  const [financeiro, setFinanceiro] = useState<Financeiro>({ saldoRestante: null, taxaCartao: 5.4, totalComTaxa: null, formasCusteio: [] });
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [dataAssinaturaTermos, setDataAssinaturaTermos] = useState<string | null>(null);
  const [dataCirurgia, setDataCirurgia] = useState<string | null>(null);
  const [datasTermos, setDatasTermos] = useState<DataDisponivel[]>([]);
  const [parcelasPagas, setParcelasPagas] = useState(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [alterandoTermos, setAlterandoTermos] = useState(false);
  const [alterandoCirurgia, setAlterandoCirurgia] = useState(false);
  const [formaCusteio, setFormaCusteio] = useState<FormaCusteio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let montado = true;
    async function carregar() {
      try {
        const [resAgenda, resBoletos] = await Promise.all([fetch("/api/cliente/agenda", { cache: "no-store" }), fetch("/api/cliente/boletos", { cache: "no-store" })]);
        if (!resAgenda.ok || !montado) return;
        const data = await resAgenda.json();
        setFinanceiro(data.financeiro ?? { saldoRestante: null, taxaCartao: 5.4, totalComTaxa: null, formasCusteio: [] });
        setSolicitacao(data.solicitacaoLiberacaoFinanceira ?? null);
        const agenda = data.agendamentoAtivo ?? data.agendamentoConcluido ?? null;
        setDataAssinaturaTermos(agenda?.data ?? null);
        setDataCirurgia(agenda?.previsaoLiberacaoFinanceira ?? null);
        setDatasTermos(data.datasDisponiveis ?? []);
        if (resBoletos.ok) { const boletosData = await resBoletos.json(); setQuantidadeParcelas(Number(boletosData.quantidade_parcelas ?? boletosData.boletos?.length ?? 0)); setParcelasPagas(Number(boletosData.parcelas_pagas ?? 0)); }
      } catch {}
    }
    void carregar();
    const intervalo = setInterval(() => void carregar(), 5000);
    return () => { montado = false; clearInterval(intervalo); };
  }, [ativo]);

  const saldoRestante = Number(financeiro.saldoRestante ?? 0);
  const taxaCartao = saldoRestante * (Number(financeiro.taxaCartao ?? 5.4) / 100);
  const totalCartao = financeiro.totalComTaxa ?? saldoRestante + taxaCartao;
  const parcelasRestantes = Math.max(0, quantidadeParcelas - parcelasPagas);
  const formasDisponiveis = useMemo(() => ["cartao", "pix", "cheques", "boleto_100"].filter(f => financeiro.formasCusteio.includes(f)) as FormaCusteio[], [financeiro.formasCusteio]);
  const status = String(solicitacao?.status ?? "").toLowerCase();
  const recusada = status.includes("recus"); const aprovada = status.includes("aprov");

  function abrirModal() { setErro(null); setFormaCusteio(solicitacao?.forma_custeio ?? null); setModalAberto(true); }
  async function enviar() { if (!formaCusteio) return; setEnviando(true); setErro(null); try { const res = await fetch("/api/cliente/solicitacao-liberacao-financeira", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formaCusteio }) }); const data = await res.json(); if (!res.ok) throw new Error(data.erro ?? "Não foi possível enviar sua solicitação."); setSolicitacao(data.solicitacao ?? null); setModalAberto(false); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar sua solicitação."); } finally { setEnviando(false); } }

  async function remarcarTermos(dataId: string, horario: string) {
    setErro(null); setEnviando(true);
    try { const res = await fetch("/api/cliente/remarcar-agendamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataId, horario }) }); const data = await res.json(); if (!res.ok) throw new Error(data.erro ?? "Não foi possível alterar a data dos termos."); setDataAssinaturaTermos(data.data); setDataCirurgia(null); setAlterandoTermos(false); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar a data dos termos."); } finally { setEnviando(false); }
  }

  if (!ativo) return null;

  const renderDataCard = (titulo: string, iso: string, tipo: "termos" | "cirurgia") => {
    const data = partesData(iso);
    const alterando = tipo === "termos" ? alterandoTermos : alterandoCirurgia;
    const abrirAlteracao = () => {
      setErro(null);
      if (tipo === "termos") setAlterandoTermos(true);
      else setAlterandoCirurgia(true);
    };
    return <div className="group relative flex min-h-[150px] flex-col justify-between rounded-2xl border border-rose/12 bg-white px-5 py-5 shadow-[0_12px_35px_-28px_rgba(82,28,42,.38)] transition-all duration-200 hover:border-rose/25 hover:shadow-[0_16px_38px_-26px_rgba(82,28,42,.3)] dark:border-white/8 dark:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.54rem] font-semibold uppercase tracking-[0.2em] text-clay/45 dark:text-pearl/40">{titulo}</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-heading text-[2.55rem] font-semibold leading-none tracking-[-0.04em] text-burgundy dark:text-cream">{data.dia}</span>
            <span className="pb-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-rose">{data.mes}</span>
          </div>
          <p className="mt-1 text-[0.62rem] font-medium tracking-[0.12em] text-clay/45 dark:text-pearl/40">{data.ano}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose/[0.06] text-rose/70 ring-1 ring-inset ring-rose/10 dark:bg-rose/[0.08] dark:text-rose/80">
          <CalendarDays className="h-[17px] w-[17px]" />
        </span>
      </div>
      <button type="button" onClick={abrirAlteracao} disabled={alterando} aria-label={`Alterar data de ${titulo.toLowerCase()}`} className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg border border-rose/15 bg-rose/[0.035] px-2.5 py-1.5 text-[0.54rem] font-bold uppercase tracking-[0.12em] text-burgundy transition hover:border-rose/30 hover:bg-rose/[0.07] disabled:cursor-default disabled:opacity-45 dark:border-white/8 dark:bg-white/[0.025] dark:text-cream">
        <Pencil className="h-3 w-3" /> {alterando ? "Alterando..." : "Alterar data"}
      </button>
    </div>;
  };

  return <div className="flex flex-col gap-4">
    {dataAssinaturaTermos && dataCirurgia && <section className="overflow-hidden rounded-2xl border border-rose/15 bg-white/75 shadow-[0_14px_40px_-28px_rgba(0,0,0,.3)] dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-center justify-between gap-3 border-b border-rose/10 px-4 py-3.5 sm:px-5">
        <div className="min-w-0"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-rose">Minha agenda</p><p className="mt-0.5 text-xs text-clay/50 dark:text-pearl/40">Datas registradas para o seu atendimento.</p></div>
        <span className="shrink-0 rounded-full border border-success/15 bg-success/[0.06] px-2.5 py-1 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-success">Confirmada</span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        {renderDataCard("Assinatura dos termos", dataAssinaturaTermos, "termos")}
        {renderDataCard("Data da sua cirurgia", dataCirurgia, "cirurgia")}
      </div>
      <p className="px-4 pb-4 text-center text-[0.58rem] leading-relaxed text-clay/45 dark:text-pearl/35">As duas datas foram registradas: assinatura dos termos e data da cirurgia.</p>
    </section>}

    {dataAssinaturaTermos && !dataCirurgia && <section className={cn("overflow-hidden rounded-2xl border shadow-[0_14px_40px_-28px_rgba(0,0,0,.35)]", recusada ? "border-alert/15 bg-alert/[0.045]" : "border-success/15 bg-success/[0.045]")}>
      <div className="flex items-center gap-2.5 px-3 py-3 sm:px-3.5 sm:py-3.5"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", recusada ? "bg-alert/10 text-alert" : "bg-success/10 text-success")}><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className={cn("text-[0.58rem] font-semibold uppercase tracking-[0.14em]", recusada ? "text-alert" : "text-success")}>{recusada ? "Custeio precisa de revisão" : aprovada ? "Custeio confirmado" : "Próxima etapa"}</p><h3 className="mt-0.5 font-heading text-sm font-semibold leading-tight text-burgundy">{recusada ? "Revise a forma de custeio" : "Informe como será realizado o pagamento do saldo restante"}</h3><p className="mt-0.5 text-[0.62rem] leading-[1.4] text-clay/55">{recusada ? "A solicitação anterior foi recusada. Você pode informar novamente a forma de custeio." : "Depois de informar a forma de custeio, a agenda da cirurgia será liberada para seleção."}</p></div>{(!solicitacao || recusada) && <button type="button" onClick={abrirModal} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-rose px-2.5 py-2 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-white shadow-card transition hover:opacity-90"><CreditCard className="h-3 w-3" /> Informar custeio</button>}{solicitacao && !recusada && <span className="hidden shrink-0 rounded-lg border border-success/15 bg-success/10 px-2.5 py-1.5 text-[0.54rem] font-bold uppercase tracking-[0.08em] text-success sm:inline-flex">{aprovada ? "Custeio confirmado" : "Custeio enviado"}</span>}</div>
    </section>}

    {alterandoTermos && <section className="overflow-hidden rounded-2xl border border-rose/15 bg-white/75 p-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-white/[0.035] sm:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-burgundy dark:text-cream">Escolha uma nova data para os termos</p><button type="button" onClick={() => !enviando && setAlterandoTermos(false)} className="rounded-full p-1 text-clay/50 hover:bg-blush dark:text-pearl/50 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div><CalendarioAgendamento datas={datasTermos} onConfirmar={remarcarTermos} confirmando={enviando} /></section>}

    {dataAssinaturaTermos && !solicitacao && !dataCirurgia && <section className="relative overflow-hidden rounded-2xl border border-rose/15 bg-white/70 p-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-white/[0.035] sm:p-4"><div className="relative"><div className="pointer-events-none select-none blur-[4px] opacity-45"><CalendarioCirurgia dataAssinatura={dataAssinaturaTermos} onConfirmada={() => {}} /></div><div className="absolute inset-0 z-10 flex items-center justify-center px-3"><div className="w-full max-w-[32rem] rounded-2xl border border-gold/30 bg-white/95 p-6 text-center shadow-[0_18px_55px_-25px_rgba(82,28,42,.28)] backdrop-blur-sm dark:border-white/10 dark:bg-[#25161b]/95 sm:p-8"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold"><LockKeyhole className="h-5 w-5" /></div><h3 className="mt-5 font-heading text-xl font-semibold text-rose dark:!text-rose">Agenda da cirurgia indisponivel no momento</h3><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-clay/65 dark:text-pearl/60">Escolha primeiro a forma de custeio do valor restante. Depois disso, esta agenda será liberada para seleção.</p></div></div></div></section>}
    {solicitacao && dataAssinaturaTermos && !dataCirurgia && !alterandoCirurgia && <CalendarioCirurgia dataAssinatura={dataAssinaturaTermos} onConfirmada={setDataCirurgia} />}
    {solicitacao && dataAssinaturaTermos && dataCirurgia && alterandoCirurgia && <div><CalendarioCirurgia dataAssinatura={dataAssinaturaTermos} dataCirurgiaAtual={dataCirurgia} onConfirmada={(data) => { setDataCirurgia(data); setAlterandoCirurgia(false); }} /><button type="button" onClick={() => setAlterandoCirurgia(false)} className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-rose/15 bg-white/70 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-clay/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-pearl/55">Cancelar alteração</button></div>}

    <AnimatePresence>{modalAberto && <motion.div className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget && !enviando) setModalAberto(false); }}><motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} className="my-auto w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-rose/15 bg-white p-4 text-clay shadow-2xl dark:border-white/10 dark:bg-[#171618] dark:text-white sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[0.6rem] font-semibold uppercase tracking-label text-rose">Custeio do valor restante</p><h2 className="mt-1 font-heading text-base font-semibold text-burgundy dark:text-cream">Informe como será realizado o pagamento</h2></div><button type="button" onClick={() => !enviando && setModalAberto(false)} className="rounded-full p-1.5 text-clay/50 hover:bg-blush dark:text-white/50 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-blush/45 p-3 dark:bg-white/[0.045]"><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Parcelas pagas</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{parcelasPagas} de {quantidadeParcelas || "—"}</p></div><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Parcelas restantes</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{parcelasRestantes}</p></div><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Valor restante</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(saldoRestante)}</p></div><div><p className="text-[0.55rem] font-semibold uppercase tracking-label text-clay/45">Cartão com taxa</p><p className="mt-0.5 text-sm font-bold text-burgundy dark:text-rose">{formatarMoeda(totalCartao)}</p></div></div><div className="mt-3 grid gap-2">{formasDisponiveis.map(forma => { const titulo = forma === "cartao" ? "Cartão de crédito" : forma === "pix" ? "PIX" : forma === "cheques" ? "Cheques" : "100% boleto"; const descricao = forma === "cartao" ? "taxa configurada no contrato" : forma === "pix" ? "sem taxa adicional" : "análise de até 5 dias úteis"; return <button key={forma} type="button" onClick={() => setFormaCusteio(forma)} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition", formaCusteio === forma ? "border-burgundy bg-burgundy text-cream" : "border-rose/15 bg-white text-clay/70 hover:border-rose dark:border-white/10 dark:bg-white/[0.035] dark:text-white/75")}><span><span className="block text-[0.72rem] font-semibold">{titulo}</span><span className="block text-[0.6rem] opacity-60">{descricao}</span></span><span className={cn("h-3.5 w-3.5 rounded-full border", formaCusteio === forma ? "border-cream bg-cream" : "border-clay/25")} /></button>; })}</div>{formasDisponiveis.length === 0 && <p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">Nenhuma forma de custeio está disponível para este contrato no momento.</p>}{erro && <p className="mt-3 rounded-xl bg-alert/10 p-3 text-xs text-alert">{erro}</p>}<button type="button" onClick={enviar} disabled={!formaCusteio || enviando || formasDisponiveis.length === 0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-3 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-cream transition hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-45">{enviando ? "Enviando..." : "Confirmar custeio e liberar agenda"}</button></motion.div></motion.div>}</AnimatePresence>
  </div>;
}
