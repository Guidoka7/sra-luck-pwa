"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addMonths, format, getDaysInMonth, isBefore, isToday, startOfDay, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, FileCheck2, Heart, Lock, Search, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface DataDisponivel { id: string; data: string; vagasRestantes: number; }
interface CalendarioAgendamentoProps { datas: DataDisponivel[]; onConfirmar: (dataId: string) => void; confirmando: boolean; bloqueado?: boolean; }
const HORARIOS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
const TAXA_CARTAO = 0.054;
type EstadoDia = "disponivel" | "lotado" | "passado";
type StatusRevisao = "pendente" | "aprovada" | "recusada" | null;
type FormaCusteio = "cartao" | "pix" | "cheques";
interface BoletoResumo { id: string; numero_parcela: number; total_parcelas: number; valor: number; status: string; }
function parseDataLocal(iso: string): Date { const [ano, mes, dia] = iso.split("-").map(Number); return new Date(ano, mes - 1, dia); }
function adicionarDiasUteis(data: Date, dias: number): Date { const resultado = new Date(data); let restantes = dias; while (restantes > 0) { resultado.setDate(resultado.getDate() + 1); const diaSemana = resultado.getDay(); if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1; } return resultado; }
function formatarMoeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function CalendarioAgendamento({ datas, onConfirmar, confirmando, bloqueado = false }: CalendarioAgendamentoProps) {
  const hoje = startOfDay(new Date());
  const [mesAtual, setMesAtual] = useState(() => { const hojeStr = format(hoje, "yyyy-MM-dd"); const futuras = datas.map((d) => d.data).filter((data) => data >= hojeStr).sort(); return futuras[0] ? startOfMonth(parseDataLocal(futuras[0])) : startOfMonth(hoje); });
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [statusRevisao, setStatusRevisao] = useState<StatusRevisao>(null);
  const [dataAtingiuPercentual, setDataAtingiuPercentual] = useState<string | null>(null);
  const [modalLevantamento, setModalLevantamento] = useState(false);
  const [modalCusteio, setModalCusteio] = useState(false);
  const [formaCusteio, setFormaCusteio] = useState<FormaCusteio | null>(null);
  const [boletos, setBoletos] = useState<BoletoResumo[]>([]);
  const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);
  const [erroFinanceiro, setErroFinanceiro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregarFinanceiro() {
      try {
        const res = await fetch("/api/cliente/boletos", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!ativo) return;
        setStatusRevisao(data.status_revisao_financeira ?? null);
        setDataAtingiuPercentual(data.data_atingiu_percentual ?? null);
        setBoletos(data.boletos ?? []);
        setSolicitacaoEnviada(Boolean(data.solicitacao_liberacao_financeira));
      } catch {}
    }
    carregarFinanceiro();
    const intervalo = setInterval(carregarFinanceiro, 30_000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, []);

  const porData = useMemo(() => { const mapa = new Map<string, DataDisponivel>(); for (const d of datas) mapa.set(d.data, d); return mapa; }, [datas]);
  const primeiroDiaSemana = useMemo(() => startOfMonth(mesAtual).getDay(), [mesAtual]);
  const diasDoMes = useMemo(() => getDaysInMonth(mesAtual), [mesAtual]);
  const celulas = useMemo(() => Array.from({ length: primeiroDiaSemana + diasDoMes }, (_, i) => i < primeiroDiaSemana ? null : i - primeiroDiaSemana + 1), [primeiroDiaSemana, diasDoMes]);

  function estadoDoDia(dia: Date): EstadoDia { if (isBefore(dia, hoje)) return "passado"; const entrada = porData.get(format(dia, "yyyy-MM-dd")); if (!entrada) return "lotado"; return entrada.vagasRestantes > 0 ? "disponivel" : "lotado"; }
  function mudarMes(delta: 1 | -1) { setDirecao(delta); setMesAtual((atual) => (delta === 1 ? addMonths(atual, 1) : subMonths(atual, 1))); setDiaSelecionado(null); setHorarioSelecionado(null); }
  function selecionarDia(dia: Date, estado: EstadoDia) { if (estado !== "disponivel") return; const chave = format(dia, "yyyy-MM-dd"); setDiaSelecionado(chave === diaSelecionado ? null : chave); setHorarioSelecionado(null); }
  const entradaSelecionada = diaSelecionado ? porData.get(diaSelecionado) : null;
  const saldoRestante = boletos.filter((b) => b.status !== "pago").reduce((total, b) => total + Number(b.valor || 0), 0);
  const taxaCartao = saldoRestante * TAXA_CARTAO;
  const totalCartao = saldoRestante + taxaCartao;
  const prazoLevantamento = dataAtingiuPercentual ? adicionarDiasUteis(parseDataLocal(dataAtingiuPercentual), 5) : null;

  async function abrirCusteio() {
    setErroFinanceiro(null); setCarregandoFinanceiro(true);
    try { const res = await fetch("/api/cliente/boletos", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.erro ?? "Não foi possível carregar o saldo restante."); setBoletos(data.boletos ?? []); setSolicitacaoEnviada(Boolean(data.solicitacao_liberacao_financeira)); setFormaCusteio(null); setModalCusteio(true); }
    catch (e) { setErroFinanceiro(e instanceof Error ? e.message : "Não foi possível carregar o saldo restante."); }
    finally { setCarregandoFinanceiro(false); }
  }
  async function enviarSolicitacao() {
    if (!formaCusteio) return; setEnviandoSolicitacao(true); setErroFinanceiro(null);
    try { const res = await fetch("/api/cliente/solicitacao-liberacao-financeira", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formaCusteio }) }); const data = await res.json(); if (!res.ok) throw new Error(data.erro ?? "Não foi possível enviar sua solicitação."); setSolicitacaoEnviada(true); }
    catch (e) { setErroFinanceiro(e instanceof Error ? e.message : "Não foi possível enviar sua solicitação."); }
    finally { setEnviandoSolicitacao(false); }
  }

  return (
    <div className="relative">
      {statusRevisao === "aprovada" && (
        <div className="mb-4 rounded-2xl border border-success/20 bg-success/[0.06] p-3.5 sm:p-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-success/10"><CheckCircle2 className="h-4.5 w-4.5 text-success" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-burgundy">Parabéns! Sua agenda foi liberada.</p><p className="mt-0.5 text-xs leading-relaxed text-clay/60">Agora você pode escolher sua data e informar a forma de custeio do saldo restante.</p></div></div>
          <button type="button" onClick={abrirCusteio} disabled={carregandoFinanceiro || solicitacaoEnviada} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-label text-cream shadow-card transition hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-60"><CreditCard className="h-4 w-4" />{solicitacaoEnviada ? "Solicitação em análise" : "Solicitar liberação financeira"}</button>
        </div>
      )}

      <div className={bloqueado ? "pointer-events-none select-none blur-[2px]" : ""}>
        <div className="mb-3 flex items-center justify-between"><button onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy/70 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-90"><ChevronLeft className="h-4 w-4" /></button><AnimatePresence mode="wait"><motion.h3 key={format(mesAtual, "yyyy-MM")} initial={{ opacity: 0, y: direcao === 1 ? 8 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: direcao === 1 ? -8 : 8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="font-heading text-sm font-semibold capitalize text-burgundy">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</motion.h3></AnimatePresence><button onClick={() => mudarMes(1)} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy/70 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-90"><ChevronRight className="h-4 w-4" /></button></div>
        <div className="mb-1.5 grid grid-cols-7 text-center">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d} className="text-[0.58rem] font-semibold uppercase tracking-label text-rose/80">{d}</span>)}</div>
        <AnimatePresence mode="wait"><motion.div key={format(mesAtual, "yyyy-MM")} initial={{ opacity: 0, x: direcao === 1 ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direcao === 1 ? -16 : 16 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="mx-auto grid max-w-[24rem] grid-cols-7 gap-1.5 sm:max-w-[26rem] sm:gap-2">
          {celulas.map((numero, i) => {
            if (numero === null) return <span key={`vazio-${i}`} className="aspect-square" aria-hidden="true" />;
            const dia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), numero);
            const estado = estadoDoDia(dia); const chave = format(dia, "yyyy-MM-dd"); const selecionado = chave === diaSelecionado; const ehHoje = isToday(dia);
            return <button key={chave} onClick={() => selecionarDia(dia, estado)} disabled={estado !== "disponivel"} title={estado === "lotado" ? "Agenda lotada" : undefined} style={{ animationDelay: `${i * 8}ms` }} className={cn("group relative aspect-square animate-fadeIn rounded-xl border text-[0.78rem] transition-all duration-200", estado === "passado" && "border-transparent text-clay/20", estado === "lotado" && "cursor-not-allowed border-transparent bg-alert/[0.06] text-alert/45 line-through decoration-alert/30", estado === "disponivel" && !selecionado && "border-success/35 bg-success/10 font-medium text-success shadow-sm hover:-translate-y-0.5 hover:border-success/55 hover:bg-success/20 hover:shadow-card cursor-pointer", selecionado && "animate-popIn border-2 border-gold bg-burgundy font-semibold text-cream shadow-soft cursor-pointer")}><span className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5", ehHoje && !selecionado && "ring-2 ring-rose/60 ring-inset rounded-xl")}><span className={cn(ehHoje && !selecionado && "text-rose font-bold")}>{numero}</span></span>{estado === "lotado" && <span className="pointer-events-none absolute -top-1.5 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-burgundy-dark px-2 py-1 text-[0.6rem] font-medium normal-case text-cream shadow-soft group-hover:block">Agenda lotada</span>}</button>;
          })}
        </motion.div></AnimatePresence>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-rose/10 pt-4 text-[0.65rem] text-clay/60"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-success/40 bg-success/15" /> Disponível</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-alert/40" /> Agenda lotada</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-2 ring-rose/60" /> Hoje</span></div>
        <AnimatePresence>{diaSelecionado && entradaSelecionada && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"><div className="mt-5 border-t border-rose/10 pt-4"><p className="mb-3 flex items-center justify-center gap-2 text-center text-xs text-clay/60"><Clock3 className="h-3.5 w-3.5 text-rose" /> Horários disponíveis para assinatura dos termos em <span className="font-heading font-semibold text-burgundy">{format(parseDataLocal(diaSelecionado), "d 'de' MMMM", { locale: ptBR })}</span></p><div className="mx-auto grid max-w-sm grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">{HORARIOS.map((h) => { const selecionado = h === horarioSelecionado; return <button key={h} onClick={() => setHorarioSelecionado(h)} className={cn("animate-fadeUp rounded-lg border px-2.5 py-2 text-xs font-medium transition-all duration-200", selecionado ? "border-burgundy bg-burgundy text-cream shadow-card" : "border-rose/20 bg-white text-clay/70 hover:-translate-y-0.5 hover:border-rose hover:text-burgundy hover:shadow-sm")}>{h}</button>; })}</div><AnimatePresence>{horarioSelecionado && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-4 flex flex-col items-center gap-2.5 rounded-xl bg-blush/50 p-4 text-center"><p className="text-xs text-clay/70">Você selecionou <span className="font-heading font-semibold text-burgundy">{format(parseDataLocal(diaSelecionado), "d 'de' MMMM", { locale: ptBR })}</span> às <span className="font-heading font-semibold text-burgundy">{horarioSelecionado}</span></p><Button onClick={() => onConfirmar(entradaSelecionada.id)} loading={confirmando} className="w-full sm:w-auto"><Sparkles className="h-4 w-4" /> Confirmar data da assinatura</Button></motion.div>}</AnimatePresence></div></motion.div>}</AnimatePresence>
        {datas.every((d) => d.vagasRestantes <= 0) && datas.length > 0 && <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-clay/45"><Lock className="h-3.5 w-3.5" /> Todas as datas deste período estão com agenda lotada.</p>}
      </div>

      {bloqueado && <button type="button" onClick={() => setModalLevantamento(true)} className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/35 px-5 text-center backdrop-blur-[1px]"><span className="max-w-xs rounded-2xl border border-gold/30 bg-white/95 p-5 shadow-card transition hover:shadow-soft"><span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15"><Lock className="h-5 w-5 text-gold" /></span>{statusRevisao === "pendente" ? <><span className="block font-heading font-semibold text-burgundy">Estamos realizando seu levantamento financeiro</span><span className="mt-2 block text-sm leading-relaxed text-clay/65">Sua agenda está em análise para liberação. Esse processo pode levar até <strong className="text-burgundy">5 dias úteis</strong>.</span>{prazoLevantamento && <span className="mt-3 inline-flex rounded-full bg-gold/10 px-3 py-1.5 text-[0.68rem] font-semibold text-burgundy">Previsão: {format(prazoLevantamento, "dd/MM/yyyy")}</span>}<span className="mt-3 block text-[0.65rem] font-medium text-burgundy/55">Toque para entender como funciona</span></> : statusRevisao === "recusada" ? <><span className="block font-heading font-semibold text-burgundy">Precisamos revisar seu levantamento</span><span className="mt-2 block text-sm leading-relaxed text-clay/65">Encontramos uma divergência e nossa equipe precisa regularizar as informações antes de liberar sua agenda.</span></> : <><span className="block font-heading font-semibold text-burgundy">Agenda indisponível por enquanto</span><span className="mt-2 block text-sm leading-relaxed text-clay/65">Quando seus pagamentos atingirem a porcentagem necessária, você poderá escolher sua data para a assinatura dos termos.</span></>}</span></button>}

      <AnimatePresence>
        {modalLevantamento && <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-burgundy/35 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalLevantamento(false)}><motion.div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-rose/15 bg-cream p-6 shadow-2xl" initial={{ opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .98 }} onClick={(e) => e.stopPropagation()}><button onClick={() => setModalLevantamento(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-clay/50 hover:bg-blush hover:text-burgundy"><X className="h-4 w-4" /></button><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose/10"><Search className="h-9 w-9 text-burgundy" /></div><h3 className="font-heading text-2xl font-semibold text-center text-burgundy">Estamos realizando seu levantamento financeiro</h3><p className="mt-3 text-center text-sm leading-relaxed text-clay/70">Para liberar sua agenda, precisamos conferir seus pagamentos e analisar o seu contrato antes de concluir a liberação.</p><div className="mt-5 space-y-3 rounded-2xl bg-blush/40 p-4"><div className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 flex-none text-burgundy" /><p className="text-sm text-clay/75">Esse processo pode levar <strong className="text-burgundy">até 5 dias úteis.</strong></p></div><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-burgundy" /><p className="text-sm text-clay/75">Assim que concluir, você será avisada e poderá escolher sua data.</p></div><div className="flex gap-3"><Heart className="mt-0.5 h-5 w-5 flex-none text-burgundy" /><p className="text-sm text-clay/75">Seguimos com você até realizar seu sonho!</p></div></div><Button className="mt-5 w-full" onClick={() => setModalLevantamento(false)}>Entendi</Button></motion.div></motion.div>}

        {modalCusteio && <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-burgundy/35 p-3 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalCusteio(false)}><motion.div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-rose/15 bg-cream p-5 shadow-2xl sm:p-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} onClick={(e) => e.stopPropagation()}><button onClick={() => setModalCusteio(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-clay/50 hover:bg-blush hover:text-burgundy"><X className="h-4 w-4" /></button><p className="text-[0.62rem] font-bold uppercase tracking-label text-rose">Próximo passo</p><h3 className="mt-1 font-heading text-2xl font-semibold text-burgundy">Solicitar liberação financeira</h3><p className="mt-2 text-sm leading-relaxed text-clay/65">Escolha a forma de custeio para o valor restante do seu contrato.</p><div className="mt-4 rounded-2xl border border-gold/25 bg-gold/[0.07] p-4"><p className="text-[0.62rem] font-semibold uppercase tracking-label text-clay/50">Saldo restante do contrato</p><p className="mt-1 font-heading text-2xl font-semibold text-burgundy">{formatarMoeda(saldoRestante)}</p><p className="mt-1 text-xs text-clay/55">Calculado automaticamente pelas parcelas ainda não pagas.</p></div><div className="mt-4 space-y-2"><p className="text-xs font-semibold text-burgundy">Escolha a forma de custeio</p>{([["cartao", "Cartão de crédito", "Mediante taxa da máquina (5,4%)", totalCartao], ["pix", "PIX", "À vista, sem taxa adicional", saldoRestante], ["cheques", "Cheques", "Mediante análise", saldoRestante]] as const).map(([valor, titulo, descricao, total]) => <button key={valor} type="button" onClick={() => setFormaCusteio(valor)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", formaCusteio === valor ? "border-burgundy bg-burgundy/[0.05] shadow-sm" : "border-rose/15 bg-white hover:border-rose/30")}><span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-full", formaCusteio === valor ? "bg-burgundy text-cream" : "bg-blush text-burgundy")}>{valor === "cartao" ? <CreditCard className="h-4 w-4" /> : valor === "pix" ? <span className="text-xs font-black">PIX</span> : <FileCheck2 className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-burgundy">{titulo}</span><span className="block text-xs text-clay/55">{descricao}</span></span><span className="text-right"><span className="block text-sm font-semibold text-burgundy">{formatarMoeda(total)}</span>{valor === "cartao" && <span className="block text-[0.6rem] text-clay/50">com taxa</span>}</span></button>)}</div>{formaCusteio === "cartao" && <div className="mt-3 rounded-xl bg-success/[0.07] p-3 text-xs text-clay/70">Saldo: <strong>{formatarMoeda(saldoRestante)}</strong> + 5,4% de taxa ({formatarMoeda(taxaCartao)}) = <strong className="text-burgundy">{formatarMoeda(totalCartao)}</strong>.</div>}{formaCusteio === "cheques" && <div className="mt-3 rounded-xl bg-gold/[0.08] p-3 text-xs text-clay/70">O valor informado é o saldo atual. A aprovação do pagamento em cheques depende de análise da equipe.</div>}{erroFinanceiro && <p className="mt-3 rounded-xl bg-alert/5 p-3 text-xs text-alert">{erroFinanceiro}</p>}{solicitacaoEnviada ? <div className="mt-4 flex items-center gap-3 rounded-2xl bg-success/[0.07] p-3.5"><CheckCircle2 className="h-5 w-5 flex-none text-success" /><p className="text-sm text-clay/70"><strong className="text-burgundy">Solicitação enviada.</strong> Nossa equipe irá analisar a forma de custeio informada.</p></div> : <Button className="mt-4 w-full" disabled={!formaCusteio} loading={enviandoSolicitacao} onClick={enviarSolicitacao}><Send className="h-4 w-4" /> Enviar solicitação</Button>}</motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
