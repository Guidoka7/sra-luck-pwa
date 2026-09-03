"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { formatarCpf } from "@/lib/cpf";
import { formatarMoeda } from "@/lib/utils";

function dataBR(value: string | null) {
  if (!value) return "Não identificado";
  const [a, m, d] = value.split("-").map(Number);
  return Number.isFinite(a) ? new Date(a, m - 1, d).toLocaleDateString("pt-BR") : "Não identificado";
}

function campo(label: string, value: unknown) {
  return <div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">{label}</p><p className="mt-1 break-words text-xs font-medium text-burgundy dark:text-[#eadbd8]">{value === null || value === undefined || value === "" ? "Não identificado" : String(value)}</p></div>;
}

export default function ImportacaoBoletoDetalhePage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [carnes, setCarnes] = useState<any[]>([]);
  const [boletos, setBoletos] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [carneId, setCarneId] = useState("");
  const [boletoId, setBoletoId] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const response = await fetch(`/api/admin/importacao-boletos/${params.id}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro);
    setItem(data.importacao);
    setClienteId(data.importacao.cliente_id ?? "");
    setCarneId(data.importacao.carne_id ?? "");
    setBoletoId(data.importacao.boleto_id ?? "");
    const clientesResponse = await fetch("/api/admin/clientes", { cache: "no-store" });
    const clientesData = await clientesResponse.json();
    if (clientesResponse.ok) setClientes(clientesData.clientes ?? []);
  }

  useEffect(() => { void carregar().catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar a importação.")); }, [params.id]);

  useEffect(() => {
    if (!clienteId) { setCarnes([]); setBoletos([]); return; }
    void Promise.all([
      fetch(`/api/admin/carnes?cliente_id=${encodeURIComponent(clienteId)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/boletos?cliente_id=${encodeURIComponent(clienteId)}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([carnesData, boletosData]) => {
      setCarnes(carnesData.carnes ?? []);
      setBoletos(boletosData.boletos ?? []);
      if (carneId && !(carnesData.carnes ?? []).some((c: any) => c.id === carneId)) setCarneId("");
      if (boletoId && !(boletosData.boletos ?? []).some((b: any) => b.id === boletoId)) setBoletoId("");
    }).catch(() => toast.error("Não foi possível carregar os vínculos disponíveis."));
  }, [clienteId]);

  const boletosFiltrados = useMemo(() => carneId ? boletos.filter((boleto) => boleto.carne_id === carneId) : [], [boletos, carneId]);

  async function salvar(confirmar: boolean) {
    if (!clienteId || !carneId || !boletoId) { toast.error("Selecione cliente, carnê e boleto existente antes de confirmar."); return; }
    setSalvando(true);
    try {
      const response = await fetch(`/api/admin/importacao-boletos/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliente_id: clienteId, carne_id: carneId, boleto_id: boletoId, confirmar }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro);
      setItem(data.importacao);
      toast.success(confirmar ? "Vinculação confirmada." : "Vinculação atualizada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a vinculação."); }
    finally { setSalvando(false); }
  }

  if (!item) return <Panel><p className="text-sm text-burgundy">Carregando importação…</p></Panel>;
  const cliente = item.clientes;
  const carne = item.carnes;
  const boleto = item.boletos;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/admin/importacao-boletos" className="inline-flex items-center gap-2 text-xs font-semibold text-burgundy/60 hover:text-burgundy"><ArrowLeft className="h-3.5 w-3.5" /> Voltar para importações</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader eyebrow="Financeiro / Importação" title="Detalhes da importação" description={item.arquivo_nome ?? "Documento PDF"} /><StatusPill tone={item.status === "vinculado" ? "success" : item.status === "erro" ? "alert" : "gold"}>{item.status}</StatusPill></div>

      {item.status === "erro" && <Panel><div className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-burgundy" /><div><p className="text-sm font-semibold text-burgundy">PDF não processado</p><p className="mt-1 text-xs text-clay/55">{item.erro_detalhes ?? "Erro não identificado."}</p></div></div></Panel>}

      <Panel>
        <SectionHeading title="Dados extraídos" description="Somente informações encontradas no PDF são exibidas; o restante permanece como Não identificado." />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {campo("Banco", item.instituicao_financeira)}
          {campo("Nome do pagador", item.nome_pagador_extraido)}
          {campo("CPF", item.cpf_pagador_extraido ? formatarCpf(item.cpf_pagador_extraido) : null)}
          {campo("Nosso Número", item.nosso_numero)}
          {campo("Número do Documento", item.numero_documento)}
          {campo("Identificador externo", item.identificador_externo)}
          {campo("Linha Digitável", item.linha_digitavel)}
          {campo("Código de barras", item.codigo_barras)}
          {campo("Valor", item.valor_extraido === null ? null : formatarMoeda(Number(item.valor_extraido)))}
          {campo("Vencimento", dataBR(item.vencimento_extraido))}
          {campo("Parcela", item.numero_parcela ? `${item.numero_parcela}${item.dados_extraidos?.total_parcelas ? `/${item.dados_extraidos.total_parcelas}` : ""}` : null)}
          {campo("Arquivo", item.arquivo_nome)}
        </div>
      </Panel>

      <Panel>
        <SectionHeading title="Vinculação" description="Selecione apenas registros que já existem no sistema. Nenhum cadastro financeiro é criado nesta tela." />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="space-y-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Cliente</span><Select value={clienteId} onChange={(event) => { setClienteId(event.target.value); setCarneId(""); setBoletoId(""); }}><option value="">Selecione uma cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_completo} · {formatarCpf(c.cpf)}</option>)}</Select></label>
          <label className="space-y-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Carnê</span><Select value={carneId} onChange={(event) => { setCarneId(event.target.value); setBoletoId(""); }} disabled={!clienteId}><option value="">Selecione um carnê existente</option>{carnes.map((c) => <option key={c.id} value={c.id}>{c.identificador_externo} · {c.instituicao_financeira}</option>)}</Select></label>
          <label className="space-y-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Boleto / parcela</span><Select value={boletoId} onChange={(event) => setBoletoId(event.target.value)} disabled={!carneId}><option value="">Selecione um boleto existente</option>{boletosFiltrados.map((b) => <option key={b.id} value={b.id}>{String(b.numero_parcela).padStart(2, "0")}/{b.total_parcelas} · {formatarMoeda(Number(b.valor))} · {dataBR(b.data_vencimento)}</option>)}</Select></label>
        </div>

        <div className="mt-5 rounded-2xl border border-rose/10 bg-blush/20 p-4 dark:border-white/8 dark:bg-white/[0.025]">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-burgundy/45">Conferência antes de concluir</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {campo("Cliente", cliente?.nome_completo ?? clientes.find((c) => c.id === clienteId)?.nome_completo)}
            {campo("Carnê", carne?.identificador_externo ?? carnes.find((c) => c.id === carneId)?.identificador_externo)}
            {campo("Parcela", boleto ? `${boleto.numero_parcela}/${boleto.total_parcelas}` : boletosFiltrados.find((b) => b.id === boletoId) ? `${boletosFiltrados.find((b) => b.id === boletoId).numero_parcela}/${boletosFiltrados.find((b) => b.id === boletoId).total_parcelas}` : null)}
            {campo("Valor", boleto ? formatarMoeda(Number(boleto.valor)) : item.valor_extraido === null ? null : formatarMoeda(Number(item.valor_extraido)))}
            {campo("Vencimento", boleto?.data_vencimento ?? item.vencimento_extraido)}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => salvar(false)} disabled={salvando}><Save className="h-3.5 w-3.5" /> Salvar vinculação</Button><Button onClick={() => salvar(true)} disabled={salvando}><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar vinculação</Button></div>
      </Panel>

      <Panel>
        <SectionHeading title="Histórico da importação" />
        <div className="mt-4 space-y-2">{(Array.isArray(item.historico) ? item.historico : []).map((evento: any, index: number) => <div key={`${evento.em}-${index}`} className="flex items-start gap-3 rounded-xl border border-rose/8 bg-white/50 p-3 dark:border-white/6 dark:bg-white/[0.02]"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-burgundy/50" /><div><p className="text-xs font-semibold text-burgundy">{evento.acao}</p><p className="mt-0.5 text-[10px] text-clay/45">{new Date(evento.em).toLocaleString("pt-BR")}</p></div></div>)}</div>
      </Panel>
    </div>
  );
}
