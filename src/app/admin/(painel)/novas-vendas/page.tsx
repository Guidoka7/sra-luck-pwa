"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag, ChevronRight, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";
import { STATUS_NOVA_VENDA_LABEL, type NovaVenda, type StatusNovaVenda } from "@/types/database";

const STATUS: Array<StatusNovaVenda | "todos"> = ["todos", "aguardando_cadastro", "aguardando_boletos", "financeiro_concluido"];

function StatusPill({ status }: { status: StatusNovaVenda }) {
  const classes = status === "aguardando_cadastro" ? "bg-warning/10 text-warning" : status === "aguardando_boletos" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-success/10 text-success";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${classes}`}>{STATUS_NOVA_VENDA_LABEL[status]}</span>;
}

export default function NovasVendasPage() {
  const [vendas, setVendas] = useState<NovaVenda[]>([]);
  const [status, setStatus] = useState<StatusNovaVenda | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contador, setContador] = useState(0);

  async function carregar() {
    setCarregando(true); setErro(null);
    try {
      const params = new URLSearchParams();
      if (status !== "todos") params.set("status", status);
      if (busca.trim()) params.set("busca", busca.trim());
      const res = await fetch(`/api/admin/novas-vendas?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível carregar as novas vendas.");
      setVendas(data.vendas ?? []); setContador(data.contador ?? 0);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar novas vendas."); setVendas([]); }
    finally { setCarregando(false); }
  }

  useEffect(() => { void carregar(); }, [status]);
  useEffect(() => { const t = window.setTimeout(() => void carregar(), 250); return () => window.clearTimeout(t); }, [busca]);

  const totalExibido = useMemo(() => vendas.length, [vendas]);

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose">Operação</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-burgundy sm:text-3xl"><ShoppingBag className="h-6 w-6" /> Novas Vendas</h1><p className="mt-1 text-sm text-clay/50">Vendas recebidas do CRM e prontas para entrar no fluxo financeiro.</p></div>
      <Button variant="secondary" size="sm" onClick={() => void carregar()} disabled={carregando}><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</Button>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Card className="p-3"><p className="text-[9px] font-semibold uppercase tracking-label text-rose">Pendentes</p><p className="mt-1 text-xl font-semibold text-burgundy">{contador}</p></Card>
      <Card className="p-3"><p className="text-[9px] font-semibold uppercase tracking-label text-rose">Exibidas</p><p className="mt-1 text-xl font-semibold text-burgundy">{totalExibido}</p></Card>
      <Card className="col-span-2 hidden p-3 sm:block"><p className="text-[9px] font-semibold uppercase tracking-label text-rose">Fluxo</p><p className="mt-1 text-xs text-clay/55">CRM → nova venda → cadastro → boletos → financeiro concluído</p></Card>
    </div>

    <Card className="space-y-3 p-3">
      <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay/30" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF…" className="pl-10" /></div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">{STATUS.map((item) => <button key={item} onClick={() => setStatus(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${status === item ? "bg-burgundy text-cream" : "bg-cream text-clay/55 hover:bg-blush"}`}>{item === "todos" ? "Todos" : STATUS_NOVA_VENDA_LABEL[item]}</button>)}</div>
    </Card>

    {erro ? <Card className="p-8 text-center"><p className="text-sm text-alert">{erro}</p><p className="mt-1 text-xs text-clay/45">Se a migration ainda não foi aplicada no banco de homologação, esta área permanecerá indisponível até a criação da tabela.</p><Button size="sm" className="mt-3" onClick={() => void carregar()}>Tentar novamente</Button></Card> : carregando ? <Card className="p-10 text-center text-sm text-clay/45">Carregando novas vendas…</Card> : vendas.length === 0 ? <Card className="p-10 text-center"><p className="text-sm text-clay/55">Nenhuma nova venda encontrada.</p><p className="mt-1 text-xs text-clay/35">Quando o webhook do RD Station estiver ativo, vendas concluídas aparecerão aqui.</p></Card> : <Card className="overflow-hidden p-0"><div className="divide-y divide-rose/5">{vendas.map((venda) => <Link key={venda.id} href={`/admin/novas-vendas/${venda.id}`} className="grid gap-3 px-4 py-3.5 transition hover:bg-blush/20 sm:grid-cols-[minmax(0,1.6fr)_140px_130px_28px] sm:items-center sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-burgundy">{venda.nome_completo}</p><p className="mt-0.5 truncate text-[10px] text-clay/40">{venda.cpf || "CPF pendente"} · {venda.vendedora_responsavel || "Vendedora não informada"}</p></div><div><p className="text-[9px] uppercase tracking-label text-rose">Venda</p><p className="text-xs text-clay/60">{new Date(venda.data_venda).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center justify-between gap-2 sm:block"><StatusPill status={venda.status} /><p className="mt-1 text-xs font-semibold text-burgundy">{formatarMoeda(venda.valor_contrato)}</p></div><ChevronRight className="hidden h-4 w-4 text-clay/25 sm:block" /></Link>)}</div></Card>}
  </div>;
}
