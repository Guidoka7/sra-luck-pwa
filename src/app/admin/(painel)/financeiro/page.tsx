"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, BadgeDollarSign, CalendarClock, CheckCircle2, CircleDollarSign, CreditCard, Landmark, ReceiptText, RefreshCw, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatarMoeda } from "@/lib/utils";
import type { StatusBoleto } from "@/types/database";

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

function brDate(value: string | null) { if (!value) return "—"; const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR"); }
function percent(value: number) { return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; }
function month(value: string) { const [y, m] = value.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); }

const sections = [
  ["Central Financeira", "Visão executiva", "/admin/financeiro", Landmark],
  ["Contas a Receber", "Parcelas e cobrança", "/admin/parcelas", WalletCards],
  ["Clientes", "Carteira financeira", "/admin/clientes", Users],
  ["Recebimentos", "Pagamentos confirmados", "/admin/pagamentos?status=pago", CheckCircle2],
  ["Comissões", "Eventos e repasses", "/admin/comissoes", BadgeDollarSign],
  ["Integrações", "Conectores e conciliação", "/admin/conciliacao-bancaria", CreditCard],
  ["Histórico", "Auditoria financeira", "/admin/parcelas", ReceiptText],
];

export default function FinanceiroPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState("todos");

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

  const maxSerie = useMemo(() => Math.max(1, ...(data?.serie ?? []).flatMap((s) => [s.previsto, s.recebido])), [data]);
  const k = data?.kpis;

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Centro de comando financeiro" title="Central Financeira" description="Receitas, contas a receber, recebimentos, inadimplência e comissões em uma única visão operacional." actions={<Button variant="secondary" size="sm" onClick={() => void carregar()} loading={loading}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>} />

    <Panel className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-clay/45"><CalendarClock className="h-3.5 w-3.5" /> Período</div>
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-auto" />
        <span className="text-xs text-clay/35">até</span><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-auto" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="todos">Todos os status</option><option value="nao_pago">Não pagos</option><option value="pago">Pagos</option><option value="pendente_confirmacao">Aguardando confirmação</option><option value="rejeitado">Rejeitados</option></Select>
        <div className="ml-auto hidden text-[10px] text-clay/40 sm:block">{data ? `${brDate(data.periodo.inicio)} — ${brDate(data.periodo.fim)}` : "Carregando…"}</div>
      </div>
    </Panel>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Total a receber" value={formatarMoeda(k?.totalReceber ?? 0)} icon={WalletCards} detail="Parcelas em aberto no período" />
      <Kpi label="Total recebido" value={formatarMoeda(k?.totalRecebido ?? 0)} icon={ArrowDownToLine} tone="success" detail={`${data?.contagens.recebimentos ?? 0} recebimentos`} />
      <Kpi label="Valores vencidos" value={formatarMoeda(k?.totalVencido ?? 0)} icon={AlertTriangle} tone="alert" detail={`${data?.contagens.vencidos ?? 0} parcelas vencidas`} />
      <Kpi label="Valores pendentes" value={formatarMoeda(k?.totalPendente ?? 0)} icon={CircleDollarSign} tone="gold" detail={`${data?.contagens.pendentes ?? 0} aguardando confirmação`} />
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Previsão de recebimento" value={formatarMoeda(k?.previsaoRecebimento ?? 0)} icon={ArrowUpRight} />
      <Metric label="Taxa de recebimento" value={percent(k?.taxaRecebimento ?? 0)} icon={CheckCircle2} />
      <Metric label="Taxa de inadimplência" value={percent(k?.taxaInadimplencia ?? 0)} icon={AlertTriangle} alert />
      <Metric label="Comissões geradas" value={formatarMoeda(k?.comissoesGeradas ?? 0)} icon={BadgeDollarSign} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <Panel className="p-4 sm:p-5">
        <SectionHeading title="Recebimentos por mês" description="Previsto x realizado, usando os boletos oficiais do sistema." />
        <div className="mt-5 h-56 overflow-hidden">
          {loading ? <div className="flex h-full items-center justify-center text-xs text-clay/35">Atualizando indicadores…</div> : <div className="flex h-full items-end gap-2 sm:gap-4">{(data?.serie ?? []).map((item) => <div key={item.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="flex h-[180px] items-end justify-center gap-1.5"><div title={`Previsto: ${formatarMoeda(item.previsto)}`} className="w-1/2 max-w-8 rounded-t-md bg-burgundy/18 transition-all" style={{ height: `${Math.max(3, (item.previsto / maxSerie) * 100)}%` }} /><div title={`Recebido: ${formatarMoeda(item.recebido)}`} className="w-1/2 max-w-8 rounded-t-md bg-success/65 transition-all" style={{ height: `${Math.max(3, (item.recebido / maxSerie) * 100)}%` }} /></div><span className="truncate text-center text-[9px] font-semibold uppercase text-clay/40">{month(item.mes)}</span></div>)}</div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-clay/50"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-burgundy/20" /> Previsto</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-success/65" /> Recebido</span></div>
      </Panel>

      <Panel className="p-4 sm:p-5"><SectionHeading title="Contas por status" description="Distribuição atual da carteira." /><div className="mt-4 space-y-3">{(data?.statusResumo ?? []).map((item) => <div key={item.status}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-burgundy">{STATUS_LABEL[item.status]}</span><span className="text-clay/45">{item.quantidade} · {formatarMoeda(item.valor)}</span></div><div className="h-2 overflow-hidden rounded-full bg-clay/8"><div className={cn("h-full rounded-full", item.status === "pago" ? "bg-success" : item.status === "pendente_confirmacao" ? "bg-gold" : item.status === "rejeitado" ? "bg-alert" : "bg-burgundy/55")} style={{ width: `${Math.min(100, ((item.valor / Math.max(1, (data?.statusResumo ?? []).reduce((s, x) => s + x.valor, 0))) * 100))}%` }} /></div></div>)}</div></Panel>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Panel className="p-4 sm:p-5"><SectionHeading title="Próximos vencimentos" description="Ações rápidas levam para a gestão oficial das parcelas." /><div className="mt-4 divide-y divide-white/8">{(data?.proximosVencimentos ?? []).slice(0, 7).map((b) => <div key={b.id} className="flex items-center gap-3 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/7 text-burgundy"><ReceiptText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-burgundy">{b.clientes?.nome_completo ?? "Cliente"}</p><p className="text-[10px] text-clay/45">Parcela {b.numero_parcela}/{b.total_parcelas} · vence {brDate(b.data_vencimento)}</p></div><div className="text-right"><p className="text-xs font-bold text-burgundy">{formatarMoeda(b.valor)}</p><StatusPill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</StatusPill></div></div>)}{!data?.proximosVencimentos.length && <p className="py-8 text-center text-xs text-clay/40">Nenhum próximo vencimento encontrado.</p>}</div></Panel>
      <Panel className="p-4 sm:p-5"><SectionHeading title="Acesso financeiro" description="Módulos oficiais preservados e centralizados nesta experiência." /><div className="mt-4 grid gap-2">{sections.slice(1).map(([title, description, href, Icon]) => { const I = Icon as typeof Landmark; return <Link key={title as string} href={href as string} className="group flex items-center gap-3 rounded-xl border border-rose/8 bg-white/[0.025] px-3 py-3 transition hover:border-burgundy/15 hover:bg-burgundy/[0.035]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush/60 text-burgundy"><I className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-burgundy">{title as string}</span><span className="block text-[9px] text-clay/45">{description as string}</span></span><ArrowUpRight className="h-3.5 w-3.5 text-clay/25 transition group-hover:text-burgundy" /></Link>; })}</div></Panel>
    </div>

    <Panel className="border-burgundy/10 bg-burgundy/[0.025] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-burgundy/45">Fonte oficial</p><p className="mt-1 text-sm font-semibold text-burgundy">Boletos continuam sendo a origem das parcelas e recebimentos.</p><p className="mt-1 max-w-3xl text-xs leading-5 text-clay/50">A Central Financeira agrega a operação existente sem criar uma segunda carteira financeira. Comissões permanecem vinculadas aos eventos reais do sistema.</p></div><Link href="/admin/pagamentos" className="inline-flex items-center gap-2 rounded-xl border border-burgundy/10 bg-white px-3 py-2 text-xs font-semibold text-burgundy shadow-sm hover:bg-blush/40">Abrir pagamentos <ArrowUpRight className="h-3.5 w-3.5" /></Link></div></Panel>
  </div>;
}

function Kpi({ label, value, icon: Icon, detail, tone = "neutral" }: { label: string; value: string; icon: typeof WalletCards; detail: string; tone?: "neutral" | "success" | "alert" | "gold" }) { return <Panel className="relative overflow-hidden p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone === "success" ? "bg-success/10 text-success" : tone === "alert" ? "bg-alert/10 text-alert" : tone === "gold" ? "bg-gold/10 text-gold" : "bg-burgundy/8 text-burgundy")}><Icon className="h-4 w-4" /></span><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/30">KPI</span></div><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-clay/45">{label}</p><p className="mt-1 text-xl font-bold tracking-[-0.03em] text-burgundy sm:text-2xl">{value}</p><p className="mt-1 text-[10px] text-clay/40">{detail}</p></Panel>; }
function Metric({ label, value, icon: Icon, alert = false }: { label: string; value: string; icon: typeof WalletCards; alert?: boolean }) { return <Panel className="flex items-center gap-3 p-3.5"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", alert ? "bg-alert/10 text-alert" : "bg-burgundy/7 text-burgundy")}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="truncate text-[9px] font-semibold uppercase tracking-[0.11em] text-clay/45">{label}</p><p className="mt-0.5 text-sm font-bold text-burgundy">{value}</p></div></Panel>; }
