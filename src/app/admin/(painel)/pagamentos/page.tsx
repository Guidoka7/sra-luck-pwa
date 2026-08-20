"use client";
import { fetchInstant, refreshInstant, invalidateInstantCache, getInstantCache } from "@/lib/instantCache";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  Search,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn, formatarMoeda } from "@/lib/utils";
import { formatarCpf } from "@/lib/cpf";
import type { Boleto, StatusBoleto } from "@/types/database";
import { STATUS_BOLETO_LABEL } from "@/types/database";

const STATUS_TONE: Record<StatusBoleto, "neutral" | "success" | "alert" | "gold"> = {
  nao_pago: "neutral",
  pago: "success",
  pendente_confirmacao: "gold",
  rejeitado: "alert",
};

function formatarData(data: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export default function PagamentosPage() {
  return (
    <Suspense fallback={<SkeletonRows count={4} />}>
      <PagamentosConteudo />
    </Suspense>
  );
}

function PagamentosConteudo() {
  const searchParams = useSearchParams();
  const clienteIdFiltro = searchParams.get("cliente_id");
  const statusInicial = searchParams.get("status");

  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>(statusInicial ?? "todos");
  const [busca, setBusca] = useState("");
  const [boletoAtivo, setBoletoAtivo] = useState<Boleto | null>(null);
  const [clientesAbertos, setClientesAbertos] = useState<Set<string>>(new Set());
  const [pagasAbertas, setPagasAbertas] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processandoLote, setProcessandoLote] = useState(false);

  async function carregar(force = false) {
    const params = new URLSearchParams();
    if (filtroStatus !== "todos") params.set("status", filtroStatus);
    if (clienteIdFiltro) params.set("cliente_id", clienteIdFiltro);
    const url = `/api/admin/boletos?${params.toString()}`;
    const cached = !force ? getInstantCache<{ boletos?: Boleto[] }>(url) : null;
    if (cached) { setBoletos(cached.boletos ?? []); setCarregando(false); } else setCarregando(true);
    try {
      const data = force ? await refreshInstant<{ boletos?: Boleto[] }>(url) : await fetchInstant<{ boletos?: Boleto[] }>(url);
      setBoletos(data.boletos ?? []);
      setSelecionados(new Set());
    } finally { setCarregando(false); }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus, clienteIdFiltro]);

  const boletosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return boletos;
    return boletos.filter(
      (b) =>
        b.clientes?.nome_completo.toLowerCase().includes(termo) ||
        b.clientes?.cpf.includes(termo.replace(/\D/g, ""))
    );
  }, [boletos, busca]);

  // Agrupa as parcelas por cliente, separando não pagas (com opção de seleção
  // em lote) das pagas (recolhidas por padrão). Clientes com mais parcelas em
  // aberto aparecem primeiro.
  const grupos = useMemo(() => {
    const mapa = new Map<
      string,
      { clienteId: string; nome: string; cpf: string; naoPagas: Boleto[]; pagas: Boleto[] }
    >();

    for (const b of boletosFiltrados) {
      const clienteId = b.cliente_id;
      if (!mapa.has(clienteId)) {
        mapa.set(clienteId, {
          clienteId,
          nome: b.clientes?.nome_completo ?? "Cliente",
          cpf: b.clientes?.cpf ?? "",
          naoPagas: [],
          pagas: [],
        });
      }
      const grupo = mapa.get(clienteId)!;
      if (b.status === "pago") grupo.pagas.push(b);
      else grupo.naoPagas.push(b);
    }

    // Garante que as parcelas de cada cliente fiquem sempre em ordem
    // numérica crescente (1, 2, 3... até a última), independentemente
    // da ordem em que foram criadas/importadas no banco.
    for (const grupo of mapa.values()) {
      const ordenarParcelas = (a: Boleto, b: Boleto) => {
        const numeroA = Number(a.numero_parcela) || 0;
        const numeroB = Number(b.numero_parcela) || 0;
        if (numeroA !== numeroB) return numeroA - numeroB;
        return String(a.data_vencimento ?? "").localeCompare(String(b.data_vencimento ?? ""));
      };
      grupo.naoPagas.sort(ordenarParcelas);
      grupo.pagas.sort(ordenarParcelas);
    }

    // Prioridade: clientes com parcela(s) aguardando confirmação aparecem
    // sempre primeiro (mesmo com o filtro "todos" selecionado), depois quem
    // tem mais parcelas em aberto, depois ordem alfabética.
    return Array.from(mapa.values()).sort((a, b) => {
      const aAguardando = a.naoPagas.filter((p) => p.status === "pendente_confirmacao").length;
      const bAguardando = b.naoPagas.filter((p) => p.status === "pendente_confirmacao").length;
      if (bAguardando !== aAguardando) return bAguardando - aAguardando;
      if (b.naoPagas.length !== a.naoPagas.length) return b.naoPagas.length - a.naoPagas.length;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [boletosFiltrados]);

  function alternarCliente(clienteId: string) {
    setClientesAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(clienteId)) novo.delete(clienteId);
      else novo.add(clienteId);
      return novo;
    });
  }

  function alternarPagas(clienteId: string) {
    setPagasAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(clienteId)) novo.delete(clienteId);
      else novo.add(clienteId);
      return novo;
    });
  }

  function alternarSelecionado(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarSelecionarTodos(ids: string[]) {
    setSelecionados((atual) => {
      const todosSelecionados = ids.every((id) => atual.has(id));
      const novo = new Set(atual);
      if (todosSelecionados) ids.forEach((id) => novo.delete(id));
      else ids.forEach((id) => novo.add(id));
      return novo;
    });
  }

  async function marcarSelecionadosComoPago() {
    if (selecionados.size === 0) return;
    setProcessandoLote(true);
    const ids = Array.from(selecionados);
    let sucesso = 0;
    let falhas = 0;
    try {
      const res = await fetch("/api/admin/boletos/lote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, acao: "confirmar" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro ?? "Falha ao processar as parcelas.");
      sucesso = Number(data.total ?? 0);
      falhas = ids.length - sucesso;
    } catch (error) {
      falhas = ids.length;
      toast.error(error instanceof Error ? error.message : "Falha ao processar as parcelas.");
    }
    if (sucesso > 0) toast.success(`${sucesso} parcela${sucesso > 1 ? "s" : ""} marcada${sucesso > 1 ? "s" : ""} como paga${sucesso > 1 ? "s" : ""}.`);
    if (falhas > 0) toast.error(`${falhas} parcela${falhas > 1 ? "s" : ""} não pôde${falhas > 1 ? "m" : ""} ser confirmada${falhas > 1 ? "s" : ""}.`);
    setProcessandoLote(false);
    carregar();
  }

  async function editarValor(boleto: Boleto) {
    const atual = boleto.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const digitado = window.prompt(
      `Novo valor da parcela ${boleto.numero_parcela}/${boleto.total_parcelas} (R$):`,
      atual
    );
    if (digitado === null) return; // cancelou

    const normalizado = digitado.trim().replace(/\./g, "").replace(",", ".");
    const valorNumero = Number(normalizado);
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      toast.error("Valor inválido.");
      return;
    }

    const res = await fetch(`/api/admin/boletos/${boleto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: valorNumero }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.erro ?? "Não foi possível atualizar o valor.");
      return;
    }
    toast.success("Valor da parcela atualizado.");
    carregar();
  }

  const pendentes = boletos.filter((b) => b.status === "pendente_confirmacao").length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Gestão"
        title="Pagamentos"
        description={
          pendentes > 0
            ? `${pendentes} comprovante${pendentes > 1 ? "s" : ""} aguardando sua confirmação.`
            : "Controle de parcelas: o que já entrou e o que ainda falta cobrar."
        }
      />

      <Panel className="p-5">
        <SectionHeading title="Parcelas por cliente" description="Busque por cliente, filtre por status e selecione parcelas em lote." />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-clay/30" />
            <Input
              placeholder="Buscar por nome ou CPF da cliente…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="py-2.5 pl-10 text-sm"
            />
          </div>
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-auto py-2.5 text-sm"
          >
            <option value="todos">Status: todos</option>
            {Object.entries(STATUS_BOLETO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {selecionados.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-burgundy/15 bg-burgundy/[0.06] px-4 py-3 animate-fadeIn">
            <p className="text-xs font-medium text-burgundy">
              {selecionados.size} parcela{selecionados.size > 1 ? "s" : ""} selecionada{selecionados.size > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelecionados(new Set())}
                disabled={processandoLote}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-clay/55 hover:text-burgundy disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
              <Button size="sm" loading={processandoLote} onClick={marcarSelecionadosComoPago}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como pagas
              </Button>
            </div>
          </div>
        )}

        {carregando ? (
          <SkeletonRows count={4} />
        ) : grupos.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-rose/25 bg-blush/20 p-9 text-center text-xs text-clay/45">
            Nenhuma parcela encontrada com esses filtros.
          </div>
        ) : (
          <div className="space-y-2.5">
            {grupos.map((grupo) => (
              <div className="render-when-visible" key={grupo.clienteId}>
                <ClienteGrupo
                  grupo={grupo}
                  aberto={clientesAbertos.has(grupo.clienteId)}
                  pagasAberto={pagasAbertas.has(grupo.clienteId)}
                  selecionados={selecionados}
                  onToggleAberto={() => alternarCliente(grupo.clienteId)}
                  onTogglePagas={() => alternarPagas(grupo.clienteId)}
                  onToggleSelecionado={alternarSelecionado}
                  onSelecionarTodos={alternarSelecionarTodos}
                  onAbrirModal={setBoletoAtivo}
                  onEditarValor={editarValor}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {boletoAtivo && (
        <ModalRevisao
          boleto={boletoAtivo}
          onClose={() => setBoletoAtivo(null)}
          onResolvido={() => {
            setBoletoAtivo(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

type GrupoCliente = {
  clienteId: string;
  nome: string;
  cpf: string;
  naoPagas: Boleto[];
  pagas: Boleto[];
};

function ClienteGrupo({
  grupo,
  aberto,
  pagasAberto,
  selecionados,
  onToggleAberto,
  onTogglePagas,
  onToggleSelecionado,
  onSelecionarTodos,
  onAbrirModal,
  onEditarValor,
}: {
  grupo: GrupoCliente;
  aberto: boolean;
  pagasAberto: boolean;
  selecionados: Set<string>;
  onToggleAberto: () => void;
  onTogglePagas: () => void;
  onToggleSelecionado: (id: string) => void;
  onSelecionarTodos: (ids: string[]) => void;
  onAbrirModal: (boleto: Boleto) => void;
  onEditarValor: (boleto: Boleto) => void;
}) {
  const total = grupo.naoPagas.length + grupo.pagas.length;
  const idsSelecionaveis = grupo.naoPagas.filter((b) => b.status === "nao_pago").map((b) => b.id);
  const todosSelecionados = idsSelecionaveis.length > 0 && idsSelecionaveis.every((id) => selecionados.has(id));

  const iniciais = grupo.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  return (
    <div className="overflow-hidden rounded-2xl border border-rose/10 bg-white/60">
      <button
        type="button"
        onClick={onToggleAberto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blush/25"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-[0.65rem] font-semibold text-burgundy">
            {iniciais || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-burgundy">{grupo.nome}</p>
            <p className="text-xs text-clay/40">{grupo.cpf ? formatarCpf(grupo.cpf) : ""}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {grupo.pagas.length > 0 && (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-[0.7rem] font-medium text-success">
              {grupo.pagas.length} paga{grupo.pagas.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="hidden text-xs text-clay/35 sm:inline">{total} parcela{total > 1 ? "s" : ""}</span>
          <ChevronDown className={cn("h-4 w-4 text-clay/40 transition-transform", aberto && "rotate-180")} />
        </div>
      </button>

      {aberto && (
        <div className="border-t border-rose/10 bg-white/40 px-4 py-3">
          {grupo.naoPagas.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-label text-burgundy/45">
                  Não pagas
                </span>
                {idsSelecionaveis.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelecionarTodos(idsSelecionaveis)}
                    className="flex items-center gap-1.5 text-[0.7rem] text-burgundy/60 hover:text-burgundy"
                  >
                    {todosSelecionados ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                    Selecionar todas
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-rose/10">
                <table className="w-full text-left text-[13px]">
                  <tbody>
                    {grupo.naoPagas.map((b) => {
                      const selecionavel = b.status === "nao_pago";
                      return (
                        <tr key={b.id} className="border-b border-rose/5 last:border-0 hover:bg-blush/20">
                          <td className="w-8 px-3 py-2.5">
                            {selecionavel ? (
                              <input
                                type="checkbox"
                                checked={selecionados.has(b.id)}
                                onChange={() => onToggleSelecionado(b.id)}
                                className="h-4 w-4 rounded accent-burgundy"
                              />
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5 text-clay/70">
                            {b.numero_parcela}/{b.total_parcelas}
                          </td>
                          <td className="px-2 py-2.5 text-clay/70">{formatarData(b.data_vencimento)}</td>
                          <td className="px-2 py-2.5 text-clay/70">
                            <button
                              type="button"
                              onClick={() => onEditarValor(b)}
                              className="underline decoration-dotted decoration-clay/30 underline-offset-2 hover:text-burgundy hover:decoration-burgundy"
                              title="Editar valor da parcela"
                            >
                              {formatarMoeda(b.valor)}
                            </button>
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusPill tone={STATUS_TONE[b.status]}>{STATUS_BOLETO_LABEL[b.status]}</StatusPill>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.comprovante_url && (
                                <a
                                  href={`/api/admin/boletos/${b.id}/comprovante`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-full border border-rose/15 px-2.5 py-1 text-[0.7rem] text-burgundy/70 hover:bg-blush/50"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver
                                </a>
                              )}
                              {b.status === "pendente_confirmacao" && (
                                <button
                                  onClick={() => onAbrirModal(b)}
                                  className="rounded-full bg-burgundy px-2.5 py-1 text-[0.7rem] text-pearl hover:bg-burgundy-light"
                                >
                                  Revisar
                                </button>
                              )}
                              {(b.status === "nao_pago" || b.status === "rejeitado") && (
                                <button
                                  onClick={() => onAbrirModal(b)}
                                  className="rounded-full border border-rose/15 px-2.5 py-1 text-[0.7rem] text-burgundy/70 hover:bg-blush/50"
                                >
                                  Marcar pago
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {grupo.pagas.length > 0 && (
            <div className={grupo.naoPagas.length > 0 ? "mt-3" : ""}>
              <button
                type="button"
                onClick={onTogglePagas}
                className="flex items-center gap-1.5 text-[0.7rem] font-medium text-success hover:text-success/80"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pagasAberto && "rotate-180")} />
                {grupo.pagas.length} parcela{grupo.pagas.length > 1 ? "s" : ""} paga{grupo.pagas.length > 1 ? "s" : ""}
              </button>

              {pagasAberto && (
                <div className="mt-2 overflow-hidden rounded-xl border border-rose/10">
                  <table className="w-full text-left text-[13px]">
                    <tbody>
                      {grupo.pagas.map((b) => (
                        <tr key={b.id} className="border-b border-rose/5 last:border-0 hover:bg-blush/20">
                          <td className="px-3 py-2.5 text-clay/70">
                            {b.numero_parcela}/{b.total_parcelas}
                          </td>
                          <td className="px-2 py-2.5 text-clay/70">Pago em {formatarData(b.data_pagamento)}</td>
                          <td className="px-2 py-2.5 text-clay/70">
                            <button
                              type="button"
                              onClick={() => onEditarValor(b)}
                              className="underline decoration-dotted decoration-clay/30 underline-offset-2 hover:text-burgundy hover:decoration-burgundy"
                              title="Editar valor da parcela"
                            >
                              {formatarMoeda(b.valor)}
                            </button>
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusPill tone={STATUS_TONE[b.status]}>{STATUS_BOLETO_LABEL[b.status]}</StatusPill>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.comprovante_url && (
                                <a
                                  href={`/api/admin/boletos/${b.id}/comprovante`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-full border border-rose/15 px-2.5 py-1 text-[0.7rem] text-burgundy/70 hover:bg-blush/50"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalRevisao({
  boleto,
  onClose,
  onResolvido,
}: {
  boleto: Boleto;
  onClose: () => void;
  onResolvido: () => void;
}) {
  const [observacoes, setObservacoes] = useState("");
  const [processando, setProcessando] = useState<"confirmar" | "rejeitar" | null>(null);

  async function resolver(acao: "confirmar" | "rejeitar") {
    setProcessando(acao);
    try {
      const res = await fetch(`/api/admin/boletos/${boleto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, observacoes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.erro ?? "Não foi possível processar.");
        return;
      }
      toast.success(acao === "confirmar" ? "Pagamento confirmado." : "Comprovante rejeitado.");
      onResolvido();
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-burgundy-dark/40 px-6 py-8 backdrop-blur-sm animate-fadeIn">
        <Panel className="w-full max-w-md p-8 animate-scaleIn">
        <h2 className="text-xl text-burgundy">
          {boleto.clientes?.nome_completo} — Parcela {boleto.numero_parcela}/{boleto.total_parcelas}
        </h2>
        <p className="mt-1 text-sm text-clay/55">{formatarMoeda(boleto.valor)}</p>

        {boleto.comprovante_url ? (
          <a
            href={`/api/admin/boletos/${boleto.id}/comprovante`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-rose/20 bg-blush/30 px-4 py-3 text-sm text-burgundy hover:bg-blush/50"
          >
            <ExternalLink className="h-4 w-4" /> Ver comprovante enviado
          </a>
        ) : (
          <p className="mt-4 rounded-2xl bg-blush/30 px-4 py-3 text-xs text-clay/55">
            Nenhum comprovante enviado pela cliente. Você pode marcar como paga manualmente se recebeu a confirmação por outro meio.
          </p>
        )}

        <div className="mt-4">
          <Textarea
            placeholder="Observações (opcional — visível no histórico interno)"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-3">
          {boleto.comprovante_url && (
            <Button
              variant="danger"
              loading={processando === "rejeitar"}
              disabled={processando !== null}
              onClick={() => resolver("rejeitar")}
              className="flex-1"
            >
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
          )}
          <Button
            loading={processando === "confirmar"}
            disabled={processando !== null}
            onClick={() => resolver("confirmar")}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar pagamento
          </Button>
        </div>
        <button
          onClick={onClose}
          disabled={processando !== null}
          className="mt-3 w-full text-center text-xs text-clay/45 hover:text-burgundy"
        >
          Cancelar
        </button>
      </Panel>
      </div>
    </Portal>
  );
}
