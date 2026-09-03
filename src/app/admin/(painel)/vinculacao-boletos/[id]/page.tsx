"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, FileText, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatarCpf } from "@/lib/cpf";
import { formatarMoeda } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  pendente: "Pendente",
};

function dataBR(v: unknown) {
  if (!v) return "Não identificado";
  const [a, m, d] = String(v).split("-").map(Number);
  return Number.isFinite(a) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(a, m - 1, d).toLocaleDateString("pt-BR")
    : "Não identificado";
}

function campo(label: string, v: unknown) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">{label}</p>
      <p className="mt-1 break-words text-xs font-medium text-burgundy dark:text-[#eadbd8]">
        {v === null || v === undefined || v === "" ? "Não identificado" : String(v)}
      </p>
    </div>
  );
}

export default function VinculacaoDetalhe({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [carnes, setCarnes] = useState<any[]>([]);
  const [boletos, setBoletos] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [carneId, setCarneId] = useState("");
  const [boletoId, setBoletoId] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregandoRelacionamentos, setCarregandoRelacionamentos] = useState(false);

  async function carregar() {
    const r = await fetch(`/api/admin/vinculacao-boletos/${params.id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro);
    setItem(d.importacao);
    setCandidatos(d.candidatos ?? []);
    setClienteId(d.importacao.cliente_vinculado_id ?? d.importacao.cliente_sugerido_id ?? "");
    setCarneId(d.importacao.carne_vinculado_id ?? d.importacao.carne_sugerido_id ?? "");
    setBoletoId(d.importacao.boleto_vinculado_id ?? d.importacao.boleto_sugerido_id ?? "");
  }

  useEffect(() => {
    void carregar().catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar."));
    void fetch("/api/admin/clientes", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro);
        return d;
      })
      .then((d) => setClientes(d.clientes ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar clientes."));
  }, [params.id]);

  useEffect(() => {
    if (!clienteId) {
      setCarnes([]);
      setBoletos([]);
      return;
    }

    let ativo = true;
    setCarregandoRelacionamentos(true);
    setCarnes([]);
    setBoletos([]);

    Promise.all([
      fetch(`/api/admin/carnes?cliente_id=${encodeURIComponent(clienteId)}`, { cache: "no-store" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro);
        return d;
      }),
      fetch(`/api/admin/boletos?cliente_id=${encodeURIComponent(clienteId)}`, { cache: "no-store" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro);
        return d;
      }),
    ])
      .then(([c, b]) => {
        if (!ativo) return;
        const listaCarnes = c.carnes ?? [];
        setCarnes(listaCarnes);
        setBoletos(b.boletos ?? []);

        const ativos = listaCarnes.filter((carne: any) => String(carne.status ?? "").toLowerCase() === "ativo");
        if (ativos.length === 1 && !listaCarnes.some((carne: any) => carne.id === carneId)) {
          setCarneId(ativos[0].id);
          setBoletoId("");
        } else if (carneId && !listaCarnes.some((carne: any) => carne.id === carneId)) {
          setCarneId("");
          setBoletoId("");
        }
      })
      .catch((e) => {
        if (ativo) toast.error(e instanceof Error ? e.message : "Falha ao carregar cliente, carnês e boletos.");
      })
      .finally(() => {
        if (ativo) setCarregandoRelacionamentos(false);
      });

    return () => {
      ativo = false;
    };
  }, [clienteId]);

  async function analisar() {
    setAnalisando(true);
    try {
      const r = await fetch(`/api/admin/vinculacao-boletos/${params.id}/analisar`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setItem(d.importacao);
      setCandidatos(d.analise?.candidatos ?? []);
      toast.success("Análise concluída. A sugestão precisa de confirmação administrativa.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise.");
    } finally {
      setAnalisando(false);
    }
  }

  function utilizarSugestao() {
    const principal = candidatos[0];
    if (!principal?.cliente_id || !principal?.carne_id || !principal?.id) {
      toast.error("A análise não encontrou uma sugestão completa.");
      return;
    }
    setClienteId(principal.cliente_id);
    setCarneId(principal.carne_id);
    setBoletoId(principal.id);
    toast.success("Sugestão preenchida. Revise e confirme a vinculação.");
  }

  async function confirmar() {
    if (!clienteId || !carneId || !boletoId) {
      toast.error("Selecione cliente, carnê e boleto existente.");
      return;
    }

    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/vinculacao-boletos/${params.id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, carne_id: carneId, boleto_id: boletoId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setItem(d.importacao);
      toast.success("Vinculação confirmada sem alterar baixa, valor ou vencimento.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao confirmar.");
    } finally {
      setSalvando(false);
    }
  }

  const clientesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => `${c.nome_completo ?? ""} ${c.cpf ?? ""} ${c.telefone ?? ""}`.toLowerCase().includes(termo));
  }, [clientes, busca]);

  if (!item) return <Panel><p className="text-sm text-burgundy">Carregando análise…</p></Panel>;

  const nivel = item.nivel_confianca;
  const percentual = item.pontuacao_confianca === null ? 0 : Math.min(100, Number(item.pontuacao_confianca));
  const principal = candidatos[0];
  const motivos = principal?.motivos ?? [];
  const carneSelecionado = carnes.find((c) => c.id === carneId) ?? null;
  const boletosDoCarne = boletos.filter((b) => b.carne_id === carneId);
  const boletosLegados = boletos.filter((b) => !b.carne_id);
  const boletosDisponiveis = carneId && boletosDoCarne.length ? boletosDoCarne : boletosLegados;
  const boletoSelecionado = boletos.find((b) => b.id === boletoId) ?? null;
  const clienteSelecionada = clientes.find((c) => c.id === clienteId) ?? null;
  const podeConfirmar = Boolean(clienteId && carneId && boletoId && !salvando);
  const importacaoVinculada = item.status_vinculacao === "vinculado";

  return (
    <div className="space-y-5 pb-10">
      <Link href="/admin/vinculacao-boletos" className="inline-flex items-center gap-2 text-xs font-semibold text-burgundy/60 hover:text-burgundy">
        <ArrowLeft className="h-3.5 w-3.5" />Voltar para a central
      </Link>
      <PageHeader eyebrow="Financeiro / Inteligência" title="Vinculação de boleto" description={item.arquivo_nome ?? "Importação de boleto"} />

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <Panel>
            <SectionHeading title="Dados extraídos do PDF" description="Somente informações realmente encontradas no documento são exibidas." />
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campo("Banco", item.instituicao_financeira)}
              {campo("Nome", item.nome_pagador_extraido)}
              {campo("CPF", item.cpf_pagador_extraido ? formatarCpf(item.cpf_pagador_extraido) : null)}
              {campo("Nosso Número", item.nosso_numero)}
              {campo("Identificador", item.identificador_externo)}
              {campo("Linha digitável", item.linha_digitavel)}
              {campo("Código de barras", item.codigo_barras)}
              {campo("Valor", item.valor_extraido === null ? null : formatarMoeda(Number(item.valor_extraido)))}
              {campo("Vencimento", dataBR(item.vencimento_extraido))}
              {campo("Parcela", item.numero_parcela)}
              {campo("Documento", item.numero_documento)}
              {campo("Arquivo", item.arquivo_nome)}
            </div>
          </Panel>

          <Panel>
            <SectionHeading title="Vinculação manual" description="A seleção segue obrigatoriamente Cliente → Carnê → Boleto. Todos os relacionamentos são carregados do banco." />
            <div className="mt-5 space-y-5">
              <label className="block space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Passo 1 · Cliente</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/30" />
                  <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar por nome, CPF ou telefone…" />
                </div>
                <Select
                  value={clienteId}
                  disabled={importacaoVinculada}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    setCarneId("");
                    setBoletoId("");
                  }}
                >
                  <option value="">Selecione uma cliente</option>
                  {clientesFiltradas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome_completo} · {c.cpf ? formatarCpf(c.cpf) : "CPF não informado"}</option>
                  ))}
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Passo 2 · Carnê</span>
                <Select
                  disabled={!clienteId || carregandoRelacionamentos || importacaoVinculada}
                  value={carneId}
                  onChange={(e) => {
                    setCarneId(e.target.value);
                    setBoletoId("");
                  }}
                >
                  <option value="">{carregandoRelacionamentos ? "Carregando carnês…" : "Selecione o carnê"}</option>
                  {carnes.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} · {c.instituicao_financeira ?? "Instituição não informada"} · {c.quantidade_parcelas ?? "—"} parcelas · {statusLabel[c.status] ?? c.status ?? "Status não informado"}
                    </option>
                  ))}
                </Select>
                {clienteId && !carregandoRelacionamentos && carnes.length === 0 && (
                  <p className="text-[10px] text-clay/50">Esta cliente não possui carnês cadastrados.</p>
                )}
              </label>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">Passo 3 · Boleto</span>
                <Select disabled={!carneId || carregandoRelacionamentos || importacaoVinculada} value={boletoId} onChange={(e) => setBoletoId(e.target.value)}>
                  <option value="">{carregandoRelacionamentos ? "Carregando boletos…" : "Selecione o boleto"}</option>
                  {boletosDoCarne.length > 0 ? boletosDoCarne.map((b) => (
                    <option key={b.id} value={b.id}>
                      Parcela {String(b.numero_parcela).padStart(2, "0")}/{b.total_parcelas} · {formatarMoeda(Number(b.valor))} · {dataBR(b.data_vencimento)} · {b.status}
                    </option>
                  )) : boletosLegados.map((b) => (
                    <option key={b.id} value={b.id}>
                      Parcela {String(b.numero_parcela).padStart(2, "0")}/{b.total_parcelas} · {formatarMoeda(Number(b.valor))} · {dataBR(b.data_vencimento)} · boleto antigo sem carnê
                    </option>
                  ))}
                </Select>
                {carneId && !carregandoRelacionamentos && boletosDoCarne.length === 0 && boletosLegados.length === 0 && (
                  <p className="text-[10px] text-clay/50">Este carnê não possui boletos cadastrados.</p>
                )}
                {carneId && !carregandoRelacionamentos && boletosDoCarne.length === 0 && boletosLegados.length > 0 && (
                  <p className="rounded-lg bg-amber-500/8 px-3 py-2 text-[10px] text-amber-700">Boletos antigos encontrados sem carnê vinculado. A confirmação continuará sendo exclusivamente manual.</p>
                )}
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-rose/8 bg-white/40 p-4 dark:bg-white/[0.02]">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-clay/40">Resumo da vinculação</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><p className="text-[9px] uppercase text-clay/40">Cliente</p><p className="mt-1 text-xs font-semibold text-burgundy">{clienteSelecionada?.nome_completo ?? "Não selecionada"}</p></div>
                <div><p className="text-[9px] uppercase text-clay/40">Carnê</p><p className="mt-1 text-xs font-semibold text-burgundy">{carneSelecionado ? `#${carneSelecionado.id} · ${carneSelecionado.instituicao_financeira ?? "—"}` : "Não selecionado"}</p></div>
                <div><p className="text-[9px] uppercase text-clay/40">Boleto</p><p className="mt-1 text-xs font-semibold text-burgundy">{boletoSelecionado ? `Parcela ${boletoSelecionado.numero_parcela}/${boletoSelecionado.total_parcelas}` : "Não selecionado"}</p><p className="mt-1 text-[10px] text-clay/45">{boletoSelecionado ? `${formatarMoeda(Number(boletoSelecionado.valor))} · ${dataBR(boletoSelecionado.data_vencimento)}` : ""}</p></div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button disabled={!podeConfirmar} onClick={() => void confirmar()}>
                <Check className="h-3.5 w-3.5" />{salvando ? "Confirmando…" : "Confirmar vinculação"}
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="border-burgundy/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-burgundy/45">Análise automática</p>
                <p className="mt-2 text-3xl font-semibold text-burgundy">{nivel ? `${String(nivel).toUpperCase()} · ${percentual}%` : "PENDENTE"}</p>
                <p className="mt-1 text-[11px] text-clay/45">Regras determinísticas; a análise apenas sugere e nunca confirma.</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-burgundy/55" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={() => void analisar()} disabled={analisando || importacaoVinculada}>{analisando ? "Analisando…" : "Executar / atualizar análise"}</Button>
              <Button onClick={utilizarSugestao} disabled={!principal || !principal.cliente_id || !principal.carne_id || !principal.id || importacaoVinculada}>Utilizar sugestão</Button>
            </div>
          </Panel>

          <Panel>
            <SectionHeading title="Por que esta sugestão?" description="Os critérios encontrados ficam visíveis para auditoria." />
            <div className="mt-4 space-y-2">
              {motivos.length ? motivos.map((m: any, i: number) => (
                <div key={i} className="flex gap-2 rounded-xl border border-rose/8 bg-white/50 p-3 text-[11px] dark:border-white/6 dark:bg-white/[0.02]">
                  <span className={m.tipo === "positivo" ? "text-success" : "text-amber-600"}>{m.tipo === "positivo" ? "✓" : "⚠"}</span>
                  <span className="text-clay/65">{m.texto}{m.pontos ? ` · +${m.pontos}` : ""}</span>
                </div>
              )) : (
                <div className="rounded-xl bg-blush/25 p-4 text-xs text-clay/50">Execute a análise para buscar correspondências.</div>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionHeading title="Correspondência sugerida" />
            <div className="mt-4 space-y-3">
              {clienteSelecionada && <div className="rounded-xl border border-rose/8 p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-burgundy/50" /><p className="text-xs font-semibold text-burgundy">{clienteSelecionada.nome_completo}</p></div><p className="mt-1 text-[10px] text-clay/45">{clienteSelecionada.cpf ? formatarCpf(clienteSelecionada.cpf) : "CPF não informado"} · {clienteSelecionada.telefone ?? "Telefone não informado"}</p></div>}
              {carneSelecionado && <div className="rounded-xl border border-rose/8 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-clay/40">Carnê</p><p className="mt-1 text-xs font-semibold text-burgundy">#{carneSelecionado.id} · {carneSelecionado.identificador_externo ?? "Identificador não informado"}</p><p className="mt-1 text-[10px] text-clay/45">{carneSelecionado.instituicao_financeira ?? "Instituição não informada"} · {carneSelecionado.quantidade_parcelas ?? "—"} parcelas · {statusLabel[carneSelecionado.status] ?? carneSelecionado.status ?? "Status não informado"}</p></div>}
              {boletoSelecionado && <div className="rounded-xl border border-rose/8 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-clay/40">Boleto</p><p className="mt-1 text-xs font-semibold text-burgundy">Parcela {boletoSelecionado.numero_parcela}/{boletoSelecionado.total_parcelas}</p><p className="mt-1 text-[10px] text-clay/45">{formatarMoeda(Number(boletoSelecionado.valor))} · venc. {dataBR(boletoSelecionado.data_vencimento)} · status {boletoSelecionado.status}</p></div>}
              {!clienteSelecionada && !carneSelecionado && !boletoSelecionado && <div className="rounded-xl bg-blush/25 p-4 text-xs text-clay/50">Nenhuma correspondência selecionada.</div>}
            </div>
          </Panel>

          <Panel>
            <SectionHeading title="Outras possibilidades" description="Alternativas nunca são confirmadas automaticamente." />
            <div className="mt-4 space-y-2">
              {candidatos.slice(1, 4).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-rose/8 p-3">
                  <div><p className="text-xs font-semibold text-burgundy">Possibilidade {i + 2}</p><p className="text-[10px] text-clay/45">{c.clientes?.nome_completo ?? "Cliente não identificada"} · parcela {c.numero_parcela ?? "—"}</p></div>
                  <StatusPill tone="neutral">{c.percentual}%</StatusPill>
                </div>
              ))}
              {candidatos.length <= 1 && <p className="text-xs text-clay/45">Nenhuma outra correspondência relevante.</p>}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-burgundy/55" />
          <div>
            <p className="text-xs font-semibold text-burgundy">Proteção financeira</p>
            <p className="mt-1 text-[10px] leading-5 text-clay/50">A confirmação altera somente os relacionamentos da importação com cliente, carnê e boleto existente. Não dá baixa, não altera valor, vencimento, parcela ou status financeiro do boleto.</p>
          </div>
          <FileText className="ml-auto hidden h-4 w-4 text-burgundy/30 sm:block" />
        </div>
      </Panel>
    </div>
  );
}
