"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatarMoeda } from "@/lib/utils";
import { STATUS_NOVA_VENDA_LABEL, type NovaVenda, type StatusNovaVenda } from "@/types/database";

function StatusPill({ status }: { status: StatusNovaVenda }) {
  const classes = status === "aguardando_cadastro" ? "bg-warning/10 text-warning" : status === "aguardando_boletos" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-success/10 text-success";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${classes}`}>{STATUS_NOVA_VENDA_LABEL[status]}</span>;
}
function Linha({ label, value }: { label: string; value: React.ReactNode }) { return <div><p className="text-[9px] font-semibold uppercase tracking-label text-rose">{label}</p><p className="mt-1 text-sm text-clay/75">{value || "Não informado"}</p></div>; }

export default function NovaVendaDetalhe({ params }: { params: { id: string } }) {
  const [venda, setVenda] = useState<NovaVenda | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nascimento, setNascimento] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    const res = await fetch(`/api/admin/novas-vendas/${params.id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro ?? "Não foi possível carregar a venda.");
    setVenda(data.venda);
  }
  useEffect(() => { void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar venda.")); }, [params.id]);

  async function completarCadastro() {
    if (!venda || !nascimento) return;
    setProcessando(true); setMensagem(null); setErro(null);
    try {
      const res = await fetch(`/api/admin/novas-vendas/${venda.id}/cadastro`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataNascimento: nascimento }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível completar o cadastro.");
      setMensagem("Cadastro concluído. A próxima etapa é gerar os boletos.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao completar cadastro."); }
    finally { setProcessando(false); }
  }

  async function gerarBoletos() {
    if (!venda || !vencimento) return;
    setProcessando(true); setMensagem(null); setErro(null);
    try {
      const res = await fetch(`/api/admin/novas-vendas/${venda.id}/boletos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primeiroVencimento: vencimento }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível gerar os boletos.");
      setMensagem("Boletos gerados e financeiro concluído.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao gerar boletos."); }
    finally { setProcessando(false); }
  }

  if (erro && !venda) return <Card className="p-8 text-center"><p className="text-sm text-alert">{erro}</p><Link href="/admin/novas-vendas"><Button size="sm" className="mt-3">Voltar</Button></Link></Card>;
  if (!venda) return <Card className="p-10 text-center text-sm text-clay/45">Carregando venda…</Card>;

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin/novas-vendas" className="inline-flex items-center gap-2 text-xs font-semibold text-clay/55 hover:text-burgundy"><ArrowLeft className="h-4 w-4" /> Novas Vendas</Link><StatusPill status={venda.status} /></div>
    <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose">Nova venda</p><h1 className="mt-1 text-2xl font-semibold text-burgundy sm:text-3xl">{venda.nome_completo}</h1><p className="mt-1 text-sm text-clay/50">ID externo RD Station: {venda.rd_station_id}</p></div>

    {erro && <Card className="border border-alert/20 p-3"><p className="text-xs text-alert">{erro}</p></Card>}
    {mensagem && <Card className="border border-success/20 p-3"><p className="flex items-center gap-2 text-xs font-medium text-success"><CheckCircle2 className="h-4 w-4" /> {mensagem}</p></Card>}

    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4"><div className="mb-4 flex items-center gap-2"><UserRound className="h-4 w-4 text-rose" /><h2 className="text-sm font-semibold text-burgundy">Dados da Cliente</h2></div><div className="grid gap-4 sm:grid-cols-2"><Linha label="Nome completo" value={venda.nome_completo} /><Linha label="CPF" value={venda.cpf} /><Linha label="Telefone" value={venda.telefone} /><Linha label="E-mail" value={venda.email} /></div></Card>
      <Card className="p-4"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-rose" /><h2 className="text-sm font-semibold text-burgundy">Informações do Contrato</h2></div><div className="grid gap-4 sm:grid-cols-2"><Linha label="Valor contratado" value={formatarMoeda(venda.valor_contrato)} /><Linha label="Quantidade de parcelas" value={venda.quantidade_parcelas ? `${venda.quantidade_parcelas}x` : null} /><Linha label="Valor da parcela" value={venda.valor_parcela ? formatarMoeda(venda.valor_parcela) : null} /><Linha label="Taxa administrativa" value={venda.taxa_administrativa != null ? `${venda.taxa_administrativa}%` : null} /><Linha label="Vendedora" value={venda.vendedora_responsavel} /><Linha label="Tipo / origem" value={[venda.tipo_venda, venda.origem_venda].filter(Boolean).join(" · ")} /></div></Card>
    </div>

    <Card className="p-4"><h2 className="text-sm font-semibold text-burgundy">Dados pendentes</h2>{venda.status === "aguardando_cadastro" ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-xs text-clay/55">Data de nascimento é necessária para criar o acesso da cliente no sistema.</p><Input className="mt-2" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} /></div><Button onClick={completarCadastro} disabled={!nascimento || processando}>{processando ? "Salvando…" : "Completar cadastro"}</Button></div> : venda.status === "aguardando_boletos" ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-xs text-clay/55">Cadastro vinculado. Informe o primeiro vencimento para usar a geração de parcelas já existente no Sra. Luck.</p><Input className="mt-2" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div><Button onClick={gerarBoletos} disabled={!vencimento || processando}>{processando ? "Gerando…" : "Gerar boletos"}</Button></div> : <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-xs text-success">Cadastro completo e parcelas geradas.</p>{venda.cliente_id && <Link href={`/admin/clientes`} className="inline-flex items-center gap-1 text-xs font-semibold text-burgundy hover:underline">Abrir clientes <ExternalLink className="h-3 w-3" /></Link>}</div>}</Card>
  </div>;
}
