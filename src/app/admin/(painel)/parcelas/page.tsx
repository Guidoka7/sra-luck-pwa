"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, History, Plus, RotateCcw, Save, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Boleto, Cliente, LogAlteracao } from "@/types/database";

function moeda(v: number) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function ParcelasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [busca, setBusca] = useState("");
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [historico, setHistorico] = useState<LogAlteracao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [suspendendo, setSuspendendo] = useState(false);
  const [quantidadeGerar, setQuantidadeGerar] = useState("1");
  const [valorGerar, setValorGerar] = useState("");
  const [vencimentoGerar, setVencimentoGerar] = useState("");
  const [gerando, setGerando] = useState(false);

  async function carregarClientes() {
    try {
      const res = await fetch("/api/admin/clientes", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível carregar as clientes.");
      setClientes(data.clientes ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao carregar clientes."); }
  }

  async function carregarParcelas(id = clienteId) {
    if (!id) { setBoletos([]); setHistorico([]); return; }
    setCarregando(true);
    try {
      const res = await fetch(`/api/admin/clientes/${id}/parcelas`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível carregar as parcelas.");
      setBoletos(data.boletos ?? []); setHistorico(data.historico ?? []); setSelecionadas(new Set());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao carregar parcelas."); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregarClientes(); }, []);
  useEffect(() => { carregarParcelas(); }, [clienteId]);

  const clientesFiltradas = useMemo(() => { const termo = busca.trim().toLowerCase(); return clientes.filter((c) => !termo || c.nome_completo.toLowerCase().includes(termo) || c.cpf.includes(termo.replace(/\D/g, ""))).slice(0, 80); }, [clientes, busca]);
  const cliente = clientes.find((c) => c.id === clienteId);
  const pagas = boletos.filter((b) => b.status === "pago").length;
  const abertas = boletos.filter((b) => b.status !== "pago").length;
  const suspensas = boletos.filter((b) => b.suspensa).length;

  async function editar(boleto: Boleto, campo: "valor" | "data_vencimento", valor: string) {
    if (boleto.status === "pago") return;
    setSalvando(`${boleto.id}:${campo}`);
    try {
      const body = campo === "valor" ? { valor: Number(valor.replace(/\./g, "").replace(",", ".")) } : { dataVencimento: valor || null };
      const res = await fetch(`/api/admin/clientes/${clienteId}/parcelas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "editar", boletoId: boleto.id, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível alterar a parcela.");
      setBoletos((atual) => atual.map((b) => b.id === boleto.id ? { ...b, ...data.boleto, valor: Number(data.boleto.valor) } : b));
      toast.success("Parcela atualizada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao alterar parcela."); }
    finally { setSalvando(null); }
  }

  async function reabrir(boleto: Boleto) {
    if (boleto.status === "pago") return;
    const res = await fetch(`/api/admin/clientes/${clienteId}/parcelas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reabrir", boletoId: boleto.id }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.erro ?? "Não foi possível reabrir.");
    toast.success("Parcela voltou para em aberto."); await carregarParcelas();
  }

  async function excluir(boleto: Boleto) {
    if (boleto.status === "pago") return;
    if (!window.confirm(`Excluir a parcela ${boleto.numero_parcela}/${boleto.total_parcelas}?`)) return;
    const res = await fetch(`/api/admin/clientes/${clienteId}/parcelas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "excluir", boletoId: boleto.id }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.erro ?? "Não foi possível excluir.");
    toast.success("Parcela excluída."); await carregarParcelas();
  }

  async function gerar() {
    const quantidade = Number(quantidadeGerar);
    if (!clienteId || !Number.isInteger(quantidade) || quantidade < 1) return toast.error("Informe uma quantidade válida.");
    setGerando(true);
    try {
      const valor = valorGerar.trim() ? Number(valorGerar.replace(/\./g, "").replace(",", ".")) : undefined;
      const res = await fetch(`/api/admin/clientes/${clienteId}/parcelas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "gerar", quantidade, valorParcela: valor, primeiroVencimento: vencimentoGerar || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível gerar as parcelas.");
      toast.success(`${quantidade} parcela(s) adicionada(s). Total agora: ${data.totalParcelas}.`);
      setQuantidadeGerar("1"); setValorGerar(""); setVencimentoGerar(""); await carregarParcelas();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar parcelas."); }
    finally { setGerando(false); }
  }

  async function suspenderSelecionadas() {
    if (!selecionadas.size) return;
    setSuspendendo(true);
    try {
      const res = await fetch(`/api/admin/clientes/${clienteId}/parcelas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "suspender", ids: Array.from(selecionadas) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível suspender as parcelas.");
      toast.success(data.mensagem ?? "Parcelas realocadas para o final."); await carregarParcelas();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao suspender parcelas."); }
    finally { setSuspendendo(false); }
  }

  function alternar(id: string) { setSelecionadas((atual) => { const n = new Set(atual); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Gestão financeira" title="Gestão de parcelas" description="Altere somente parcelas em aberto. As parcelas já pagas ficam protegidas e não entram em recálculos." />
    <Panel className="p-4 sm:p-5"><SectionHeading title="Cliente" description="Selecione uma cliente para administrar o carnê e consultar o histórico." /><div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,2fr)]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay/30" /><Input className="pl-10" placeholder="Buscar cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div><Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">Selecione uma cliente</option>{clientesFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}</Select></div></Panel>

    {!clienteId ? <Panel className="p-10 text-center"><UserRound className="mx-auto h-8 w-8 text-burgundy/20" /><p className="mt-3 font-heading text-lg text-burgundy">Selecione uma cliente</p><p className="mt-1 text-sm text-clay/50">Aqui você poderá editar valores, vencimentos, status e suspender parcelas abertas.</p></Panel> : <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"><Resumo label="Total" valor={boletos.length} /><Resumo label="Pagas" valor={pagas} destaque /><Resumo label="Em aberto" valor={abertas} /><Resumo label="Realocadas" valor={suspensas} /></div>
      <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading title="Adicionar parcelas" description="Você não fica preso a 12, 18, 24, 36, 48, 60 ou 72. Gere qualquer quantidade adicional, de 1 a 240 no total." /><div className="rounded-xl bg-blush/40 px-3 py-2 text-right"><p className="text-[0.55rem] uppercase tracking-[0.16em] text-burgundy/45">Contrato atual</p><p className="text-lg font-semibold text-burgundy">{boletos.length}x</p></div></div><div className="grid gap-3 md:grid-cols-4"><div><label className="mb-1 block text-[0.62rem] text-clay/50">Quantidade</label><Input type="number" min="1" max="240" value={quantidadeGerar} onChange={(e) => setQuantidadeGerar(e.target.value)} /></div><div><label className="mb-1 block text-[0.62rem] text-clay/50">Valor de cada nova parcela (opcional)</label><Input inputMode="decimal" placeholder="Automático" value={valorGerar} onChange={(e) => setValorGerar(e.target.value)} /></div><div><label className="mb-1 block text-[0.62rem] text-clay/50">Primeiro vencimento (opcional)</label><Input type="date" value={vencimentoGerar} onChange={(e) => setVencimentoGerar(e.target.value)} /></div><div className="flex items-end"><Button className="w-full" loading={gerando} onClick={gerar}><Plus className="h-3.5 w-3.5" /> Gerar parcelas</Button></div></div></Panel>
      <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><SectionHeading title="Carnê da cliente" description="Edite valor e vencimento individualmente. Para suspender, selecione as parcelas em aberto e use o botão abaixo." />{selecionadas.size > 0 && <Button size="sm" loading={suspendendo} onClick={suspenderSelecionadas}><Clock3 className="h-3.5 w-3.5" /> Suspender {selecionadas.size}</Button>}</div>{carregando ? <p className="py-8 text-center text-sm text-clay/45">Carregando parcelas…</p> : <div className="overflow-x-auto rounded-2xl border border-rose/10"><table className="w-full min-w-[820px] text-left"><thead className="bg-blush/25 text-[0.6rem] uppercase tracking-[0.14em] text-clay/45"><tr><th className="w-10 px-3 py-3"> </th><th className="px-3 py-3">Parcela</th><th className="px-3 py-3">Vencimento</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Ações</th></tr></thead><tbody className="divide-y divide-rose/8">{boletos.map((b) => <ParcelaRow key={b.id} boleto={b} selecionada={selecionadas.has(b.id)} onSelecionar={() => b.status !== "pago" && alternar(b.id)} onEditar={editar} onReabrir={reabrir} onExcluir={excluir} salvando={salvando} />)}</tbody></table></div>}</Panel>
      <Panel className="p-4 sm:p-5"><button className="flex w-full items-center justify-between text-left" onClick={() => setMostrarHistorico((v) => !v)}><div className="flex items-center gap-2"><History className="h-4 w-4 text-burgundy" /><div><p className="font-heading text-base text-burgundy">Histórico de alterações</p><p className="text-xs text-clay/45">Suspensões, exclusões, reaberturas, valores e vencimentos alterados ficam registrados.</p></div></div>{mostrarHistorico ? <ChevronUp className="h-4 w-4 text-clay/40" /> : <ChevronDown className="h-4 w-4 text-clay/40" />}</button>{mostrarHistorico && <div className="mt-4 space-y-2">{historico.length === 0 ? <p className="text-sm text-clay/45">Nenhuma alteração registrada.</p> : historico.map((log) => <div key={log.id} className="rounded-xl border border-rose/8 bg-blush/15 px-3 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-burgundy">{log.acao.replaceAll("_", " ")}</p><p className="text-[0.6rem] text-clay/40">{new Date(log.created_at).toLocaleString("pt-BR")}</p></div><p className="mt-1 text-[0.68rem] text-clay/55">Responsável: {log.usuario}</p></div>)}</div>}</Panel>
    </>}
  </div>;
}

function Resumo({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) { return <div className={cn("rounded-2xl border px-3 py-3", destaque ? "border-gold/25 bg-gold/5" : "border-rose/10 bg-white/40")}><p className="text-[0.58rem] uppercase tracking-[0.14em] text-clay/40">{label}</p><p className={cn("mt-1 text-lg font-semibold", destaque ? "text-gold" : "text-burgundy")}>{valor}</p></div>; }

function ParcelaRow({ boleto, selecionada, onSelecionar, onEditar, onReabrir, onExcluir, salvando }: { boleto: Boleto; selecionada: boolean; onSelecionar: () => void; onEditar: (b: Boleto, campo: "valor" | "data_vencimento", valor: string) => void; onReabrir: (b: Boleto) => void; onExcluir: (b: Boleto) => void; salvando: string | null }) {
  const paga = boleto.status === "pago";
  const [valor, setValor] = useState(moeda(Number(boleto.valor)));
  const [data, setData] = useState(boleto.data_vencimento ?? "");
  useEffect(() => { setValor(moeda(Number(boleto.valor))); setData(boleto.data_vencimento ?? ""); }, [boleto.valor, boleto.data_vencimento]);
  const salvarValor = () => { const n = Number(valor.replace(/\./g, "").replace(",", ".")); if (Number.isFinite(n) && n > 0) onEditar(boleto, "valor", String(n)); else toast.error("Valor inválido."); };
  return <tr className={cn("align-middle", paga && "bg-emerald-50/25", boleto.suspensa && "bg-gold/5")}><td className="px-3 py-2.5"><input type="checkbox" checked={selecionada} disabled={paga} onChange={onSelecionar} aria-label={`Selecionar parcela ${boleto.numero_parcela}`} /></td><td className="px-3 py-2.5"><p className="text-sm font-semibold text-burgundy">{boleto.numero_parcela}/{boleto.total_parcelas}</p>{boleto.suspensa && <span className="text-[0.58rem] text-gold">Realocada para o final</span>}</td><td className="px-3 py-2.5"><Input type="date" value={data} disabled={paga} onChange={(e) => setData(e.target.value)} onBlur={() => data !== (boleto.data_vencimento ?? "") && onEditar(boleto, "data_vencimento", data)} className="w-[145px] text-xs" /></td><td className="px-3 py-2.5"><div className="flex items-center gap-1"><span className="text-xs text-clay/55">R$</span><Input value={valor} disabled={paga} onChange={(e) => setValor(e.target.value)} onBlur={salvarValor} className="w-[120px] text-xs" /></div></td><td className="px-3 py-2.5"><span className={cn("rounded-full px-2 py-1 text-[0.58rem] font-semibold", paga ? "bg-emerald-100 text-emerald-700" : boleto.status === "pendente_confirmacao" ? "bg-gold/10 text-gold" : "bg-burgundy/5 text-burgundy/70")}>{paga ? "Pago — protegido" : boleto.status === "pendente_confirmacao" ? "Aguardando confirmação" : "Em aberto"}</span></td><td className="px-3 py-2.5"><div className="flex flex-wrap gap-1.5">{!paga && <>{boleto.status !== "nao_pago" && <Button variant="ghost" size="sm" onClick={() => onReabrir(boleto)} title="Voltar para em aberto"><RotateCcw className="h-3 w-3" /></Button>}<Button variant="ghost" size="sm" onClick={salvarValor} disabled={salvando?.startsWith(boleto.id)}><Save className="h-3 w-3" /></Button><Button variant="ghost" size="sm" onClick={() => onExcluir(boleto)}><Trash2 className="h-3 w-3 text-alert" /></Button></>}</div></td></tr>;
}
