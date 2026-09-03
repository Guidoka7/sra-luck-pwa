"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, Eye, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { fetchInstant, getInstantCache, refreshInstant } from "@/lib/instantCache";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Portal } from "@/components/ui/Portal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn, formatarMoeda } from "@/lib/utils";
import { formatarCpf } from "@/lib/cpf";
import type { Boleto, Cliente, ConciliacaoPagamento, StatusConciliacaoPagamento } from "@/types/database";
import { BANCOS_CONCILIACAO, METODOS_CONCILIACAO_LABEL, STATUS_CONCILIACAO_LABEL, STATUS_CONCILIACAO_TONE } from "@/types/database";

const STATUS_OPTIONS: Array<[StatusConciliacaoPagamento | "todos", string]> = [
  ["todos", "Todos"], ["pendente", "Pendente"], ["conciliado", "Conciliado"], ["nao_identificado", "Não identificado"], ["divergencia", "Divergência"], ["ignorado", "Ignorado"],
];

function dataHoje() { return new Date().toISOString().slice(0, 10); }
function formatarData(data: string) { const [a, m, d] = data.split("-").map(Number); return new Date(a, m - 1, d).toLocaleDateString("pt-BR"); }
function deslocarData(data: string, dias: number) { const [a, m, d] = data.split("-").map(Number); const date = new Date(a, m - 1, d); date.setDate(date.getDate() + dias); return date.toISOString().slice(0, 10); }

export default function ConciliacaoBancariaPage() {
  return <Suspense fallback={<SkeletonRows count={7} />}><ConciliacaoConteudo /></Suspense>;
}

function ConciliacaoConteudo() {
  const [dataReferencia, setDataReferencia] = useState(dataHoje);
  const [banco, setBanco] = useState("todos");
  const [status, setStatus] = useState<StatusConciliacaoPagamento | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [pagamentos, setPagamentos] = useState<ConciliacaoPagamento[]>([]);
  const [resumo, setResumo] = useState({ totalPagamentos: 0, totalConciliado: 0, pendentes: 0, naoIdentificados: 0, divergencias: 0, valorRecebido: 0, valorConciliado: 0 });
  const [carregando, setCarregando] = useState(true);
  const [pagamentoAtivo, setPagamentoAtivo] = useState<ConciliacaoPagamento | null>(null);
  const [registrarAberto, setRegistrarAberto] = useState(false);

  async function carregar(force = false) {
    const params = new URLSearchParams({ data: dataReferencia });
    if (banco !== "todos") params.set("banco", banco);
    if (status !== "todos") params.set("status", status);
    const url = `/api/admin/conciliacao-bancaria?${params.toString()}`;
    const cached = !force ? getInstantCache<{ pagamentos?: ConciliacaoPagamento[]; resumo?: typeof resumo }>(url) : null;
    if (cached) { setPagamentos(cached.pagamentos ?? []); setResumo(cached.resumo ?? resumo); setCarregando(false); } else setCarregando(true);
    try { const data = force ? await refreshInstant<{ pagamentos?: ConciliacaoPagamento[]; resumo?: typeof resumo }>(url) : await fetchInstant(url); setPagamentos(data.pagamentos ?? []); setResumo(data.resumo ?? resumo); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar a conciliação."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dataReferencia, banco, status]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pagamentos;
    return pagamentos.filter((p) => [p.clientes?.nome_completo, p.clientes?.cpf, p.identificador_externo, p.banco].some((v) => String(v ?? "").toLowerCase().includes(termo)));
  }, [pagamentos, busca]);

  const hoje = dataHoje();
  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Financeiro" title="Conciliação Bancária" description="Central de conferência dos recebimentos. A baixa das parcelas permanece separada desta etapa." />

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-burgundy/45">Data de referência</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button onClick={() => setDataReferencia(deslocarData(dataReferencia, -1))} className="rounded-lg border border-rose/12 bg-white/70 p-2 text-burgundy/60 hover:bg-blush hover:text-burgundy dark:border-white/8 dark:bg-white/5 dark:text-white/50"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex items-center gap-2 rounded-lg border border-rose/12 bg-white/75 px-3 py-2 dark:border-white/8 dark:bg-white/5"><input type="date" value={dataReferencia} onChange={(e) => setDataReferencia(e.target.value)} className="bg-transparent text-xs font-semibold text-burgundy outline-none dark:text-[#ead8d5]" /><span className="hidden text-[10px] text-clay/35 sm:inline">{dataReferencia === hoje ? "Hoje" : formatarData(dataReferencia)}</span></div>
          <button onClick={() => setDataReferencia(deslocarData(dataReferencia, 1))} className="rounded-lg border border-rose/12 bg-white/70 p-2 text-burgundy/60 hover:bg-blush hover:text-burgundy dark:border-white/8 dark:bg-white/5 dark:text-white/50"><ChevronRight className="h-4 w-4" /></button>
          {dataReferencia !== hoje && <button onClick={() => setDataReferencia(hoje)} className="rounded-lg px-2.5 py-2 text-[10px] font-semibold text-burgundy/65 hover:bg-blush dark:text-[#d9aaa7]">Voltar para hoje</button>}
        </div>
      </div>
      <Button size="sm" onClick={() => setRegistrarAberto(true)}><Plus className="h-3.5 w-3.5" /> Registrar recebimento</Button>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Indicador label="Recebido no dia" value={formatarMoeda(resumo.valorRecebido)} detail={`${resumo.totalPagamentos} pagamento(s) identificado(s)`} />
      <Indicador label="Conciliado" value={formatarMoeda(resumo.valorConciliado)} detail={`${resumo.totalConciliado} conferido(s)`} tone="success" />
      <Indicador label="Pendentes" value={String(resumo.pendentes)} detail="Aguardando conferência" tone="gold" />
      <Indicador label="Exceções" value={String(resumo.naoIdentificados + resumo.divergencias)} detail={`${resumo.naoIdentificados} não identificado(s) · ${resumo.divergencias} divergência(s)`} tone="alert" />
    </div>

    <Panel className="overflow-hidden p-0">
      <div className="border-b border-rose/10 p-4 sm:p-5 dark:border-white/8">
        <div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading title="Pagamentos recebidos" description="Conferência por banco, status e identificação da cliente." /><span className="hidden items-center gap-1 text-[10px] text-clay/35 xl:flex"><CircleHelp className="h-3.5 w-3.5" /> Sem integração bancária nesta etapa</span></div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <div className="relative min-w-[230px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/30" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CPF ou identificador…" className="pl-9" /></div>
          <Select value={banco} onChange={(e) => setBanco(e.target.value)} className="w-auto min-w-[170px]"><option value="todos">Todos os bancos</option>{BANCOS_CONCILIACAO.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusConciliacaoPagamento | "todos")} className="w-auto min-w-[155px]"><option value="todos">Todos os status</option>{STATUS_OPTIONS.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
      </div>

      {carregando ? <div className="p-5"><SkeletonRows count={6} /></div> : lista.length === 0 ? <EmptyState data={dataReferencia} hasFilter={Boolean(busca || banco !== "todos" || status !== "todos")} /> : <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead className="border-b border-rose/10 bg-blush/20 dark:border-white/6 dark:bg-white/[0.025]"><tr>{["Data do pagamento", "Cliente", "CPF", "Parcela", "Banco", "Método", "Valor recebido", "Status", "Ações"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">{h}</th>)}</tr></thead><tbody className="divide-y divide-rose/8 dark:divide-white/6">{lista.map((p) => <PagamentoRow key={p.id} pagamento={p} onOpen={setPagamentoAtivo} />)}</tbody></table></div>}
    </Panel>

    {pagamentoAtivo && <DetalhesPagamento pagamento={pagamentoAtivo} onClose={() => setPagamentoAtivo(null)} onUpdated={() => { setPagamentoAtivo(null); void carregar(true); }} />}
    {registrarAberto && <RegistrarRecebimento dataInicial={dataReferencia} onClose={() => setRegistrarAberto(false)} onCreated={() => { setRegistrarAberto(false); void carregar(true); }} />}
  </div>;
}

function Indicador({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "gold" | "alert" }) {
  return <div className={cn("rounded-xl border border-rose/10 bg-white/65 p-4 dark:border-white/8 dark:bg-white/[0.035]", tone === "success" && "border-success/15", tone === "gold" && "border-gold/15", tone === "alert" && "border-alert/15")}><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-clay/40">{label}</p><p className={cn("mt-1.5 text-xl font-semibold tracking-tight text-burgundy", tone === "success" && "text-success", tone === "gold" && "text-gold", tone === "alert" && "text-alert")}>{value}</p><p className="mt-1 text-[10px] text-clay/40">{detail}</p></div>;
}

function PagamentoRow({ pagamento: p, onOpen }: { pagamento: ConciliacaoPagamento; onOpen: (p: ConciliacaoPagamento) => void }) {
  const boleto = p.boletos;
  return <tr className="hover:bg-blush/15 dark:hover:bg-white/[0.025]"><td className="whitespace-nowrap px-4 py-3 text-xs text-clay/65">{formatarData(p.data_pagamento)}</td><td className="max-w-[210px] px-4 py-3"><p className="truncate text-xs font-semibold text-burgundy">{p.clientes?.nome_completo ?? "Não identificada"}</p>{p.identificador_externo && <p className="mt-0.5 truncate text-[9px] text-clay/35">ID {p.identificador_externo}</p>}</td><td className="whitespace-nowrap px-4 py-3 text-[11px] text-clay/55">{p.clientes?.cpf ? formatarCpf(p.clientes.cpf) : "—"}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-clay/60">{boleto ? `${boleto.numero_parcela}/${boleto.total_parcelas}` : "—"}</td><td className="whitespace-nowrap px-4 py-3 text-[11px] font-medium text-burgundy/70">{p.banco}</td><td className="whitespace-nowrap px-4 py-3 text-[11px] text-clay/55">{METODOS_CONCILIACAO_LABEL[p.metodo_pagamento]}</td><td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-burgundy">{formatarMoeda(p.valor_recebido)}</td><td className="whitespace-nowrap px-4 py-3"><StatusPill tone={STATUS_CONCILIACAO_TONE[p.status]}>{STATUS_CONCILIACAO_LABEL[p.status]}</StatusPill></td><td className="px-4 py-3"><button onClick={() => onOpen(p)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose/10 px-2.5 py-1.5 text-[10px] font-semibold text-burgundy/65 hover:bg-blush hover:text-burgundy dark:border-white/8 dark:text-white/55"><Eye className="h-3.5 w-3.5" /> Detalhes</button></td></tr>;
}

function EmptyState({ data, hasFilter }: { data: string; hasFilter: boolean }) {
  return <div className="p-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blush/50 text-burgundy/45 dark:bg-white/5 dark:text-white/35"><SlidersHorizontal className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-burgundy">{hasFilter ? "Nenhum pagamento encontrado com estes filtros." : "Nenhum pagamento recebido para esta data."}</p><p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-clay/40">{hasFilter ? "Ajuste os filtros ou selecione outro dia para consultar os registros." : `A central está pronta para receber registros reais de ${formatarData(data)}. Nenhum dado fictício é criado para preencher a tela.`}</p></div>;
}

function DetalhesPagamento({ pagamento: inicial, onClose, onUpdated }: { pagamento: ConciliacaoPagamento; onClose: () => void; onUpdated: () => void }) {
  const [pagamento, setPagamento] = useState(inicial); const [historico, setHistorico] = useState<any[]>([]); const [clientes, setClientes] = useState<Cliente[]>([]); const [boletos, setBoletos] = useState<Boleto[]>([]); const [clienteId, setClienteId] = useState(inicial.cliente_id ?? ""); const [boletoId, setBoletoId] = useState(inicial.boleto_id ?? ""); const [motivo, setMotivo] = useState(inicial.motivo_divergencia ?? ""); const [observacao, setObservacao] = useState(inicial.observacao ?? ""); const [processando, setProcessando] = useState(false);

  useEffect(() => { void (async () => { try { const [detail, clients] = await Promise.all([fetch(`/api/admin/conciliacao-bancaria/${inicial.id}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.erro); return d; }), fetchInstant<{ clientes?: Cliente[] }>("/api/admin/clientes")]); setPagamento(detail.pagamento); setHistorico(detail.historico ?? []); setClientes(clients.clientes ?? []); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível carregar os detalhes."); } })(); }, [inicial.id]);
  useEffect(() => { if (!clienteId) { setBoletos([]); return; } void fetchInstant<{ boletos?: Boleto[] }>(`/api/admin/boletos?cliente_id=${encodeURIComponent(clienteId)}&status=todos`).then((d) => setBoletos(d.boletos ?? [])).catch(() => setBoletos([])); }, [clienteId]);

  async function acao(tipo: "vincular" | "conciliar" | "divergencia" | "nao_identificado" | "ignorar") {
    if ((tipo === "conciliar" || tipo === "vincular") && (!clienteId || !boletoId)) { toast.error("Selecione a cliente e a parcela correspondente."); return; }
    if (tipo === "divergencia" && !motivo.trim()) { toast.error("Informe o motivo da divergência."); return; }
    if (tipo === "ignorar" && !observacao.trim() && !motivo.trim()) { toast.error("Informe o motivo para ignorar o pagamento."); return; }
    setProcessando(true);
    try { const res = await fetch(`/api/admin/conciliacao-bancaria/${pagamento.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: tipo, clienteId: clienteId || undefined, boletoId: boletoId || undefined, observacao: observacao || undefined, motivoDivergencia: motivo || undefined }) }); const d = await res.json(); if (!res.ok) throw new Error(d.erro); toast.success(tipo === "conciliar" ? "Conciliação registrada." : "Pagamento atualizado."); if (tipo === "conciliar") onUpdated(); else { setPagamento(d.pagamento); const h = await fetch(`/api/admin/conciliacao-bancaria/${pagamento.id}`).then((r) => r.json()); setHistorico(h.historico ?? []); } }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o pagamento."); } finally { setProcessando(false); }
  }

  return <Portal><div className="fixed inset-0 z-50 flex justify-end bg-burgundy-dark/45 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#fbf8f7] p-5 shadow-2xl dark:bg-[#171417] sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-burgundy/45 dark:text-[#cda5a2]/55">Conferência</p><h2 className="mt-1 text-xl font-semibold text-burgundy dark:text-[#f0ddda]">Detalhes do pagamento</h2><div className="mt-2"><StatusPill tone={STATUS_CONCILIACAO_TONE[pagamento.status]}>{STATUS_CONCILIACAO_LABEL[pagamento.status]}</StatusPill></div></div><button onClick={onClose} className="rounded-xl p-2 text-clay/45 hover:bg-blush dark:hover:bg-white/8"><X className="h-5 w-5" /></button></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{[["Banco", pagamento.banco], ["Identificador externo", pagamento.identificador_externo ?? "—"], ["Data do pagamento", formatarData(pagamento.data_pagamento)], ["Valor recebido", formatarMoeda(pagamento.valor_recebido)], ["Método", METODOS_CONCILIACAO_LABEL[pagamento.metodo_pagamento]], ["Dados da origem", pagamento.dados_origem ? "Disponíveis" : "Não informados"]].map(([label, value]) => <div key={label} className="rounded-xl border border-rose/10 bg-white/70 p-3.5 dark:border-white/8 dark:bg-white/[0.035]"><p className="text-[9px] uppercase tracking-[0.14em] text-clay/35">{label}</p><p className="mt-1 text-xs font-semibold text-burgundy dark:text-[#e5d3d0]">{value}</p></div>)}</div>
    <div className="mt-6 rounded-xl border border-rose/10 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-burgundy/45">Identificação manual</p><div className="mt-3 grid gap-3"><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Cliente</label><Select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setBoletoId(""); }}><option value="">Selecione a cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_completo} · {formatarCpf(c.cpf)}</option>)}</Select></div><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Parcela correspondente</label><Select value={boletoId} onChange={(e) => setBoletoId(e.target.value)} disabled={!clienteId}><option value="">{clienteId ? "Selecione a parcela" : "Selecione a cliente primeiro"}</option>{boletos.map((b) => <option key={b.id} value={b.id}>{b.numero_parcela}/{b.total_parcelas} · {formatarMoeda(b.valor)} · vence {b.data_vencimento ? formatarData(b.data_vencimento) : "—"}</option>)}</Select></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Motivo da divergência</label><Select value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Nenhum</option><option value="Valor diferente">Valor diferente</option><option value="Cliente não localizada">Cliente não localizada</option><option value="Parcela não localizada">Parcela não localizada</option><option value="Pagamento duplicado">Pagamento duplicado</option><option value="Informação incompleta">Informação incompleta</option><option value="Outro">Outro</option></Select></div><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Observação</label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação interna…" /></div></div></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" loading={processando} onClick={() => void acao("conciliar")}>Confirmar conciliação</Button><Button size="sm" variant="secondary" loading={processando} onClick={() => void acao("vincular")}>Salvar identificação</Button><Button size="sm" variant="secondary" loading={processando} onClick={() => void acao("divergencia")}>Marcar divergência</Button><Button size="sm" variant="secondary" loading={processando} onClick={() => void acao("nao_identificado")}>Não identificado</Button><Button size="sm" variant="secondary" loading={processando} onClick={() => void acao("ignorar")}>Ignorar</Button></div>
    <div className="mt-7 border-t border-rose/10 pt-5 dark:border-white/8"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-burgundy/45">Histórico imutável</p>{historico.length === 0 ? <p className="mt-2 text-[11px] text-clay/40">Nenhuma alteração registrada.</p> : <div className="mt-3 space-y-2">{historico.map((h) => <div key={h.id} className="rounded-lg border border-rose/8 bg-white/50 p-3 dark:border-white/6 dark:bg-white/[0.025]"><div className="flex flex-wrap justify-between gap-2"><p className="text-[10px] font-semibold text-burgundy">{h.status_anterior ? `${STATUS_CONCILIACAO_LABEL[h.status_anterior]} → ` : "Registro inicial → "}{STATUS_CONCILIACAO_LABEL[h.status_novo]}</p><p className="text-[9px] text-clay/35">{new Date(h.created_at).toLocaleString("pt-BR")}</p></div><p className="mt-1 text-[9px] text-clay/45">{h.usuario}{h.observacao ? ` · ${h.observacao}` : ""}{h.motivo_divergencia ? ` · Motivo: ${h.motivo_divergencia}` : ""}</p></div>)}</div>}</div>
    <div className="mt-6 rounded-xl border border-gold/15 bg-gold/[0.035] p-3.5"><p className="text-[10px] font-semibold text-gold">Importante</p><p className="mt-1 text-[10px] leading-5 text-clay/50">Confirmar a conciliação apenas registra a conferência. A parcela financeira não é baixada ou alterada automaticamente nesta etapa.</p></div>
  </section></div></Portal>;
}

function RegistrarRecebimento({ dataInicial, onClose, onCreated }: { dataInicial: string; onClose: () => void; onCreated: () => void }) {
  const [banco, setBanco] = useState(""); const [metodo, setMetodo] = useState(""); const [data, setData] = useState(dataInicial); const [valor, setValor] = useState(""); const [identificador, setIdentificador] = useState(""); const [observacao, setObservacao] = useState(""); const [processando, setProcessando] = useState(false);
  async function salvar() { const valorNumber = Number(valor.replace(",", ".")); if (!banco || !metodo || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(valorNumber) || valorNumber < 0) { toast.error("Preencha banco, método, data e valor corretamente."); return; } setProcessando(true); try { const res = await fetch("/api/admin/conciliacao-bancaria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banco, metodoPagamento: metodo, dataPagamento: data, valorRecebido: valorNumber, identificadorExterno: identificador || undefined, observacao: observacao || undefined }) }); const d = await res.json(); if (!res.ok) throw new Error(d.erro); toast.success("Recebimento registrado para conferência."); onCreated(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar o recebimento."); } finally { setProcessando(false); } }
  return <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-burgundy-dark/45 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#fbf8f7] p-5 shadow-2xl dark:bg-[#171417] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-burgundy/45">Entrada manual</p><h2 className="mt-1 text-lg font-semibold text-burgundy dark:text-[#f0ddda]">Registrar recebimento</h2><p className="mt-1 text-[10px] text-clay/40">Use somente para registrar um recebimento real já conhecido pela equipe.</p></div><button onClick={onClose} className="rounded-lg p-2 text-clay/45 hover:bg-blush dark:hover:bg-white/8"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Banco</label><Select value={banco} onChange={(e) => setBanco(e.target.value)}><option value="">Selecione</option>{BANCOS_CONCILIACAO.map((b) => <option key={b} value={b}>{b}</option>)}</Select></div><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Método</label><Select value={metodo} onChange={(e) => setMetodo(e.target.value)}><option value="">Selecione</option>{Object.entries(METODOS_CONCILIACAO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Data do pagamento</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div><div><label className="mb-1 block text-[10px] font-semibold text-clay/50">Valor recebido</label><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></div><div className="sm:col-span-2"><label className="mb-1 block text-[10px] font-semibold text-clay/50">Identificador externo (opcional)</label><Input value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="NSU, E2E, ID bancário…" /></div><div className="sm:col-span-2"><label className="mb-1 block text-[10px] font-semibold text-clay/50">Observação</label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Dados relevantes da origem…" /></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={processando} onClick={() => void salvar()}>Registrar para conferência</Button></div></div></div></Portal>;
}
