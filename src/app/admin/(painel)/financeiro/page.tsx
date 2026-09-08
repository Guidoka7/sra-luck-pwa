"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, BadgeDollarSign, CalendarClock, CheckCircle2, CircleDollarSign, CreditCard, Landmark, ReceiptText, RefreshCw, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatarMoeda } from "@/lib/utils";
import type { StatusBoleto } from "@/types/database";
import ClientesPage from "@/app/admin/(painel)/clientes/page";
import ParcelasPage from "@/app/admin/(painel)/parcelas/page";
import PagamentosPage from "@/app/admin/(painel)/pagamentos/page";

const STATUS_LABEL: Record<string, string> = { nao_pago: "Não pago", pago: "Pago", pendente_confirmacao: "Aguardando confirmação", rejeitado: "Rejeitado" };
const STATUS_TONE: Record<string, "neutral" | "success" | "alert" | "gold"> = { nao_pago: "neutral", pago: "success", pendente_confirmacao: "gold", rejeitado: "alert" };

type Dashboard = {
  periodo: { inicio: string; fim: string };
  kpis: Record<string, number>;
  serie: { mes: string; previsto: number; recebido: number; diferenca: number }[];
  statusResumo: { status: string; quantidade: number; valor: number }[];
  proximosVencimentos: { id: string; cliente_id: string; numero_parcela: number; total_parcelas: number; valor: number; data_vencimento: string | null; status: StatusBoleto; clientes?: { nome_completo?: string } | null }[];
  contagens: { boletos: number; vencidos: number; pendentes: number; recebimentos: number };
};

type Aba = "visao" | "receber" | "clientes" | "recebimentos";

function brDate(value: string | null) { if (!value) return "—"; const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR"); }
function percent(value: number) { return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; }
function month(value: string) { const [y, m] = value.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); }
function monthRange(value: string) { const [y, m] = value.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${y}-${String(m).padStart(2, "0")}-01`, `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`] as const; }

const tabs: { id: Aba; label: string; description: string; icon: typeof Landmark }[] = [
  { id: "visao", label: "Visão geral", description: "Indicadores e gráficos", icon: Landmark },
  { id: "receber", label: "Contas a receber", description: "Parcelas e cobrança", icon: WalletCards },
  { id: "clientes", label: "Clientes", description: "Cadastro e carteira", icon: Users },
  { id: "recebimentos", label: "Recebimentos", description: "Conferência de pagamentos", icon: CheckCircle2 },
];

export default function FinanceiroPage() {
  const searchParams = useSearchParams();
  const abaQuery = searchParams.get("aba") as Aba | null;
  const [aba, setAba] = useState<Aba>(tabs.some((t) => t.id === abaQuery) ? abaQuery! : "visao");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  useEffect(() => { if (abaQuery && tabs.some((t) => t.id === abaQuery)) setAba(abaQuery); }, [abaQuery]);

  async function carregar() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (inicio) params.set("inicio", inicio);
      if (fim) params.set("fim", fim);
      if (status !== "todos") params.set("status", status);
      const res = await fetch(`/api/admin/financeiro?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não foi possível carregar o financeiro.");
      setData(json);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar o financeiro."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void carregar(); }, [inicio, fim, status]);

  function abrirAba(novaAba: Aba) {
    setAba(novaAba);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", novaAba);
    window.history.replaceState({}, "", url.toString());
  }

  function selecionarMes(mes: string) {
    const [novoInicio, novoFim] = monthRange(mes);
    setMesSelecionado(mes);
    setInicio(novoInicio);
    setFim(novoFim);
    setAba("visao");
  }

  const maxSerie = useMemo(() => Math.max(1, ...(data?.serie ?? []).flatMap((s) => [s.previsto, s.recebido])), [data]);
  const k = data?.kpis;

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Centro de comando financeiro" title="Central Financeira" description="Receitas, contas a receber, recebimentos, inadimplência e comissões em uma única visão operacional." actions={<Button variant="secondary" size="sm" onClick={() => void carregar()} loading={loading}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>} />

    <Panel className="overflow-hidden p-1.5 sm:p-2">
      <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
        {tabs.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" onClick={() => abrirAba(id)} className={cn("group rounded-xl px-3 py-2.5 text-left transition", aba === id ? "bg-burgundy text-cream shadow-sm" : "text-clay/55 hover:bg-blush/30 hover:text-burgundy")}><span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] font-bold uppercase tracking-[0.12em]">{label}</span></span><span className={cn("mt-1 hidden text-[9px] sm:block", aba === id ? "text-cream/55" : "text-clay/35")}>{description}</span></button>)}
      </div>
    </Panel>

    {aba === "visao" && <>
      <Panel className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-clay/45"><CalendarClock className="h-3.5 w-3.5" /> Período</div>
          <Input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setMesSelecionado(null); }} className="w-auto" />
          <span className="text-xs text-clay/35">até</span><Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setMesSelecionado(null); }} className="w-auto" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="todos">Todos os status</option><option value="nao_pago">Não pagos</option><option value="pago">Pagos</option><option value="pendente_confirmacao">Aguardando confirmação</option><option value="rejeitado">Rejeitados</option></Select>
          <div className="ml-auto hidden text-[10px] text-clay/40 sm:block">{data ? `${brDate(data.periodo.inicio)} — ${brDate(data.periodo.fim)}` : "Carregando…"}</div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => abrirAba("receber")} className="text-left"><Kpi label="Total a receber" value={formatarMoeda(k?.totalReceber ?? 0)} icon={WalletCards} detail="Parcelas em aberto no período" /></button>
        <button type="button" onClick={() => { setStatus("pago"); abrirAba("recebimentos"); }} className="text-left"><Kpi label="Total recebido" value={formatarMoeda(k?.totalRecebido ?? 0)} icon={ArrowDownToLine} tone="success" detail={`${data?.contagens.recebimentos ?? 0} recebimentos`} /></button>
        <button type="button" onClick={() => { setStatus("nao_pago"); abrirAba("receber"); }} className="text-left"><Kpi label="Valores vencidos" value={formatarMoeda(k?.totalVencido ?? 0)} icon={AlertTriangle} tone="alert" detail={`${data?.contagens.vencidos ?? 0} parcelas vencidas`} /></button>
        <button type="button" onClick={() => { setStatus("pendente_confirmacao"); abrirAba("recebimentos"); }} className="text-left"><Kpi label="Valores pendentes" value={formatarMoeda(k?.totalPendente ?? 0)} icon={CircleDollarSign} tone="gold" detail={`${data?.contagens.pendentes ?? 0} aguardando confirmação`} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Previsão de recebimento" value={formatarMoeda(k?.previsaoRecebimento ?? 0)} icon={ArrowUpRight} />
        <Metric label="Taxa de recebimento" value={percent(k?.taxaRecebimento ?? 0)} icon={CheckCircle2} />
        <Metric label="Taxa de inadimplência" value={percent(k?.taxaInadimplencia ?? 0)} icon={AlertTriangle} alert />
        <Metric label="Comissões geradas" value={formatarMoeda(k?.comissoesGeradas ?? 0)} icon={BadgeDollarSign} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading title="Recebimentos por mês" description="Clique em qualquer mês para filtrar a visão geral para aquele período." /><span className="rounded-full border border-burgundy/10 px-2.5 py-1 text-[9px] font-semibold text-burgundy/55">{mesSelecionado ? `Filtro: ${month(mesSelecionado)}` : "6 meses"}</span></div>
          <div className="mt-5 h-56 overflow-hidden">
            {loading ? <div className="flex h-full items-center justify-center text-xs text-clay/35">Atualizando indicadores…</div> : <div className="flex h-full items-end gap-2 sm:gap-4">{(data?.serie ?? []).map((item) => { const ativo = mesSelecionado === item.mes; return <div key={item.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><button type="button" onClick={() => selecionarMes(item.mes)} aria-label={`Filtrar por ${month(item.mes)}`} className={cn("flex h-[180px] w-full items-end justify-center gap-1.5 rounded-lg px-1 transition", ativo ? "bg-blush/35 ring-1 ring-burgundy/10" : "hover:bg-blush/15")}><span title={`Previsto: ${formatarMoeda(item.previsto)}`} className={cn("w-1/2 max-w-8 rounded-t-md bg-burgundy/18 transition-all", ativo && "bg-burgundy/35")} style={{ height: `${Math.max(3, (item.previsto / maxSerie) * 100)}%` }} /><span title={`Recebido: ${formatarMoeda(item.recebido)}`} className={cn("w-1/2 max-w-8 rounded-t-md bg-success/65 transition-all", ativo && "bg-success")} style={{ height: `${Math.max(3, (item.recebido / maxSerie) * 100)}%` }} /></button><span className={cn("truncate text-center text-[9px] font-semibold uppercase", ativo ? "text-burgundy" : "text-clay/40")}>{month(item.mes)}</span></div>; })}</div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-clay/50"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-burgundy/20" /> Previsto</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-success/65" /> Recebido</span></div>
        </Panel>

        <Panel className="p-4 sm:p-5"><SectionHeading title="Contas por status" description="Clique em um status para abrir sua operação." /><div className="mt-4 space-y-3">{(data?.statusResumo ?? []).map((item) => { const totalStatus = Math.max(1, (data?.statusResumo ?? []).reduce((s, x) => s + x.valor, 0)); return <button key={item.status} type="button" onClick={() => { setStatus(item.status); abrirAba(item.status === "pago" || item.status === "pendente_confirmacao" ? "recebimentos" : "receber"); }} className="w-full text-left"><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-burgundy">{STATUS_LABEL[item.status]}</span><span className="text-clay/45">{item.quantidade} · {formatarMoeda(item.valor)}</span></div><div className="h-2 overflow-hidden rounded-full bg-clay/8"><div className={cn("h-full rounded-full transition-all", item.status === "pago" ? "bg-success" : item.status === "pendente_confirmacao" ? "bg-gold" : item.status === "rejeitado" ? "bg-alert" : "bg-burgundy/55")} style={{ width: `${Math.min(100, (item.valor / totalStatus) * 100)}%` }} /></div></button>; })}</div></Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="p-4 sm:p-5"><SectionHeading title="Próximos vencimentos" description="Clique em uma parcela para abrir a gestão de contas a receber." /><div className="mt-4 divide-y divide-white/8">{(data?.proximosVencimentos ?? []).slice(0, 7).map((b) => <button key={b.id} type="button" onClick={() => abrirAba("receber")} className="flex w-full items-center gap-3 py-3 text-left hover:bg-blush/15"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/7 text-burgundy"><ReceiptText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-burgundy">{b.clientes?.nome_completo ?? "Cliente"}</p><p className="text-[10px] text-clay/45">Parcela {b.numero_parcela}/{b.total_parcelas} · vence {brDate(b.data_vencimento)}</p></div><div className="text-right"><p className="text-xs font-bold text-burgundy">{formatarMoeda(b.valor)}</p><StatusPill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</StatusPill></div></button>)}{!data?.proximosVencimentos.length && <p className="py-8 text-center text-xs text-clay/40">Nenhum próximo vencimento encontrado.</p>}</div></Panel>
        <Panel className="p-4 sm:p-5"><SectionHeading title="Acesso financeiro" description="Toda a operação financeira agora abre dentro desta Central." /><div className="mt-4 grid gap-2">{tabs.slice(1).map(({ id, label, description, icon: Icon }) => <button key={id} type="button" onClick={() => abrirAba(id)} className="group flex items-center gap-3 rounded-xl border border-rose/8 bg-white/[0.025] px-3 py-3 text-left transition hover:border-burgundy/15 hover:bg-burgundy/[0.035]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush/60 text-burgundy"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-burgundy">{label}</span><span className="block text-[9px] text-clay/45">{description}</span></span><ArrowUpRight className="h-3.5 w-3.5 text-clay/25 transition group-hover:text-burgundy" /></button>)}</div></Panel>
      </div>

      <Panel className="border-burgundy/10 bg-burgundy/[0.025] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-burgundy/45">Fonte oficial</p><p className="mt-1 text-sm font-semibold text-burgundy">Boletos continuam sendo a origem das parcelas e recebimentos.</p><p className="mt-1 max-w-3xl text-xs leading-5 text-clay/50">Clientes, parcelas e pagamentos são operações da mesma carteira oficial. Esta Central apenas reúne as telas e usa as APIs existentes.</p></div><Button size="sm" onClick={() => abrirAba("recebimentos")}><CheckCircle2 className="h-3.5 w-3.5" /> Conferir recebimentos</Button></div></Panel>
    </>}

    {aba === "receber" && <div className="rounded-2xl border border-rose/8 bg-transparent"><ParcelasPage /></div>}
    {aba === "clientes" && <div className="rounded-2xl border border-rose/8 bg-transparent"><ClientesPage /></div>}
    {aba === "recebimentos" && <div className="rounded-2xl border border-rose/8 bg-transparent"><PagamentosPage /></div>}
  </div>;
}

function Kpi({ label, value, icon: Icon, detail, tone = "neutral" }: { label: string; value: string; icon: typeof WalletCards; detail: string; tone?: "neutral" | "success" | "alert" | "gold" }) { return <Panel className="relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft sm:p-5"><div className="flex items-start justify-between gap-3"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone === "success" ? "bg-success/10 text-success" : tone === "alert" ? "bg-alert/10 text-alert" : tone === "gold" ? "bg-gold/10 text-gold" : "bg-burgundy/8 text-burgundy")}><Icon className="h-4 w-4" /></span><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/30">KPI</span></div><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-clay/45">{label}</p><p className="mt-1 text-xl font-bold tracking-[-0.03em] text-burgundy sm:text-2xl">{value}</p><p className="mt-1 text-[10px] text-clay/40">{detail}</p></Panel>; }
function Metric({ label, value, icon: Icon, alert = false }: { label: string; value: string; icon: typeof WalletCards; alert?: boolean }) { return <Panel className="flex items-center gap-3 p-3.5"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", alert ? "bg-alert/10 text-alert" : "bg-burgundy/7 text-burgundy")}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="truncate text-[9px] font-semibold uppercase tracking-[0.11em] text-clay/45">{label}</p><p className="mt-0.5 text-sm font-bold text-burgundy">{value}</p></div></Panel>; }
