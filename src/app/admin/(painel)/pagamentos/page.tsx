"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, ReceiptText, Search, X, AlertTriangle, Clock3, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { fetchInstant, getInstantCache, refreshInstant } from "@/lib/instantCache";
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

// Parâmetros iniciais editáveis na conferência. Eles não são gravados como
// regra global: o admin pode ajustar o cálculo para cada validação.
const DEFAULT_MULTA = 2;
const DEFAULT_JUROS_DIA = 0.033;

function formatarData(data: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

function diasEmAtraso(data: string | null) {
  if (!data) return 0;
  const [ano, mes, dia] = data.split("-").map(Number);
  const vencimento = new Date(ano, mes - 1, dia);
  vencimento.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86400000));
}

function calcularValorAtualizado(valor: number, dias: number, multaPercentual: number, jurosDiaPercentual: number, descontoPercentual: number) {
  if (dias <= 0) return { multa: 0, juros: 0, desconto: 0, total: valor };
  const multa = valor * (multaPercentual / 100);
  const juros = valor * (jurosDiaPercentual / 100) * dias;
  const subtotal = valor + multa + juros;
  const desconto = subtotal * (descontoPercentual / 100);
  return { multa, juros, desconto, total: Math.max(0, subtotal - desconto) };
}

export default function PagamentosPage() {
  return (
    <Suspense fallback={<SkeletonRows count={5} />}>
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
  const [filtroStatus, setFiltroStatus] = useState(statusInicial ?? "pendente_confirmacao");
  const [busca, setBusca] = useState("");
  const [boletoAtivo, setBoletoAtivo] = useState<Boleto | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processandoLote, setProcessandoLote] = useState(false);

  async function carregar(force = false) {
    const params = new URLSearchParams();
    if (filtroStatus !== "todos") params.set("status", filtroStatus);
    if (clienteIdFiltro) params.set("cliente_id", clienteIdFiltro);
    const url = `/api/admin/boletos?${params.toString()}`;
    const cached = !force ? getInstantCache<{ boletos?: Boleto[] }>(url) : null;
    if (cached) {
      setBoletos(cached.boletos ?? []);
      setCarregando(false);
    } else setCarregando(true);
    try {
      const data = force ? await refreshInstant<{ boletos?: Boleto[] }>(url) : await fetchInstant<{ boletos?: Boleto[] }>(url);
      setBoletos(data.boletos ?? []);
      setSelecionados(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os pagamentos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus, clienteIdFiltro]);

  const boletosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = !termo ? boletos : boletos.filter((b) =>
      b.clientes?.nome_completo.toLowerCase().includes(termo) || b.clientes?.cpf.includes(termo.replace(/\D/g, ""))
    );
    return [...lista].sort((a, b) => {
      const atrasoA = diasEmAtraso(a.data_vencimento);
      const atrasoB = diasEmAtraso(b.data_vencimento);
      if (atrasoB !== atrasoA) return atrasoB - atrasoA;
      return Number(a.numero_parcela) - Number(b.numero_parcela);
    });
  }, [boletos, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { clienteId: string; nome: string; cpf: string; parcelas: Boleto[] }>();
    for (const boleto of boletosFiltrados) {
      if (!mapa.has(boleto.cliente_id)) {
        mapa.set(boleto.cliente_id, {
          clienteId: boleto.cliente_id,
          nome: boleto.clientes?.nome_completo ?? "Cliente",
          cpf: boleto.clientes?.cpf ?? "",
          parcelas: [],
        });
      }
      mapa.get(boleto.cliente_id)!.parcelas.push(boleto);
    }
    return Array.from(mapa.values()).sort((a, b) => {
      const aguardandoA = a.parcelas.filter((p) => p.status === "pendente_confirmacao").length;
      const aguardandoB = b.parcelas.filter((p) => p.status === "pendente_confirmacao").length;
      if (aguardandoB !== aguardandoA) return aguardandoB - aguardandoA;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [boletosFiltrados]);

  function alternarSelecionado(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  async function marcarSelecionadosComoPago() {
    if (!selecionados.size) return;
    setProcessandoLote(true);
    try {
      const res = await fetch("/api/admin/boletos/lote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selecionados), acao: "confirmar" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro ?? "Falha ao confirmar pagamentos.");
      toast.success(`${Number(data.total ?? 0)} pagamento(s) confirmado(s).`);
      await carregar(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao confirmar pagamentos.");
    } finally {
      setProcessandoLote(false);
    }
  }

  async function editarValor(boleto: Boleto) {
    const atual = boleto.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const digitado = window.prompt(`Novo valor da parcela ${boleto.numero_parcela}/${boleto.total_parcelas} (R$):`, atual);
    if (digitado === null) return;
    const valor = Number(digitado.trim().replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) return toast.error("Valor inválido.");
    const res = await fetch(`/api/admin/boletos/${boleto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data.erro ?? "Não foi possível atualizar o valor.");
    }
    toast.success("Valor da parcela atualizado.");
    carregar(true);
  }

  const pendentes = boletos.filter((b) => b.status === "pendente_confirmacao").length;
  const vencidas = boletos.filter((b) => b.status !== "pago" && diasEmAtraso(b.data_vencimento) > 0).length;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Gestão"
        title="Pagamentos"
        description={pendentes > 0 ? `${pendentes} comprovante${pendentes > 1 ? "s" : ""} aguardando confirmação.` : "Revise os pagamentos e confirme os comprovantes."}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Resumo label="Aguardando confirmação" valor={pendentes} destaque />
        <Resumo label="Parcelas vencidas" valor={vencidas} alerta={vencidas > 0} />
        <Resumo label="Exibindo" valor={boletosFiltrados.length} />
      </div>

      <Panel className="p-4 sm:p-5">
        <SectionHeading title="Pagamentos" description="As parcelas aparecem abertas por padrão; clique apenas para validar o comprovante." />
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay/30" />
            <Input placeholder="Buscar cliente ou CPF…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
          </div>
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-auto">
            <option value="pendente_confirmacao">Aguardando confirmação</option>
            <option value="nao_pago">Não pagos</option>
            <option value="pago">Pagos</option>
            <option value="rejeitado">Rejeitados</option>
            <option value="todos">Todos</option>
          </Select>
        </div>

        {selecionados.size > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-burgundy/15 bg-burgundy/[0.06] px-3.5 py-2.5">
            <span className="text-xs font-medium text-burgundy">{selecionados.size} selecionada(s)</span>
            <Button size="sm" loading={processandoLote} onClick={marcarSelecionadosComoPago}><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar selecionadas</Button>
          </div>
        )}

        {carregando ? <SkeletonRows count={5} /> : grupos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rose/20 bg-blush/15 p-8 text-center text-xs text-clay/45">Nenhum pagamento encontrado.</div>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => (
              <ClientePagamentos key={grupo.clienteId} grupo={grupo} selecionados={selecionados} onSelecionar={alternarSelecionado} onAbrir={setBoletoAtivo} onEditarValor={editarValor} />
            ))}
          </div>
        )}
      </Panel>

      {boletoAtivo && <ModalValidarComprovante boleto={boletoAtivo} onClose={() => setBoletoAtivo(null)} onResolvido={() => { setBoletoAtivo(null); carregar(true); }} />}
    </div>
  );
}

function Resumo({ label, valor, destaque, alerta }: { label: string; valor: number; destaque?: boolean; alerta?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3", destaque ? "border-gold/25 bg-gold/5" : alerta ? "border-alert/20 bg-alert/5" : "border-white/10 bg-white/[0.025]")}>
      <p className="text-[0.58rem] uppercase tracking-[0.14em] text-clay/40">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", destaque ? "text-gold" : alerta ? "text-alert" : "text-burgundy")}>{valor}</p>
    </div>
  );
}

type GrupoCliente = { clienteId: string; nome: string; cpf: string; parcelas: Boleto[] };

function ClientePagamentos({ grupo, selecionados, onSelecionar, onAbrir, onEditarValor }: { grupo: GrupoCliente; selecionados: Set<string>; onSelecionar: (id: string) => void; onAbrir: (b: Boleto) => void; onEditarValor: (b: Boleto) => void }) {
  const aguardando = grupo.parcelas.filter((p) => p.status === "pendente_confirmacao").length;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-burgundy">{grupo.nome}</p>
          <p className="text-[0.62rem] text-clay/40">CPF {formatarCpf(grupo.cpf)} · {grupo.parcelas.length} parcela(s)</p>
        </div>
        {aguardando > 0 && <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[0.58rem] font-semibold text-gold">{aguardando} aguardando</span>}
      </div>

      <div className="divide-y divide-white/7">
        {grupo.parcelas.map((boleto) => {
          const atraso = diasEmAtraso(boleto.data_vencimento);
          const vencida = boleto.status !== "pago" && atraso > 0;
          const aguardandoConfirmacao = boleto.status === "pendente_confirmacao";
          return (
            <div key={boleto.id} className={cn("px-3.5 py-3", vencida && "bg-alert/[0.035]", aguardandoConfirmacao && "bg-gold/[0.035]")}>
              <div className="flex flex-wrap items-center gap-2.5">
                {aguardandoConfirmacao && <input type="checkbox" checked={selecionados.has(boleto.id)} onChange={() => onSelecionar(boleto.id)} className="h-4 w-4 accent-burgundy" aria-label={`Selecionar parcela ${boleto.numero_parcela}`} />}
                <div className="flex min-w-[74px] items-center gap-2"><ReceiptText className="h-3.5 w-3.5 text-burgundy/45" /><span className="text-xs font-semibold text-burgundy">{boleto.numero_parcela}/{boleto.total_parcelas}</span></div>
                <div className="min-w-[100px] text-[0.66rem] text-clay/50">Vence {formatarData(boleto.data_vencimento)}</div>
                <div className="ml-auto text-right"><p className="text-sm font-bold text-burgundy">{formatarMoeda(boleto.valor)}</p>{vencida && <p className="flex items-center justify-end gap-1 text-[0.58rem] font-semibold text-alert"><AlertTriangle className="h-3 w-3" /> Vencida há {atraso} dia{atraso === 1 ? "" : "s"}</p>}</div>
                <StatusPill tone={STATUS_TONE[boleto.status]}>{STATUS_BOLETO_LABEL[boleto.status]}</StatusPill>
              </div>

              {aguardandoConfirmacao && <div className="mt-2.5 grid gap-2 rounded-xl border border-gold/15 bg-gold/[0.035] p-2.5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[0.62rem] font-semibold text-gold">Comprovante enviado · confira o valor antes de validar</p><p className="mt-0.5 text-[0.58rem] text-clay/45">{boleto.comprovante_url ? "Comprovante disponível para conferência." : "A cliente marcou o pagamento, mas não há comprovante anexado."}</p></div><Button size="sm" onClick={() => onAbrir(boleto)}><ReceiptText className="h-3.5 w-3.5" /> Validar comprovante</Button></div>}

              {vencida && boleto.status !== "pendente_confirmacao" && <div className="mt-2 rounded-xl border border-alert/15 bg-alert/[0.035] px-2.5 py-2 text-[0.6rem] text-alert/80">Esta parcela está vencida. Ao receber o pagamento, confira o valor atualizado com multa, juros por dia e eventual desconto antes de confirmar.</div>}

              <div className="mt-2 flex justify-end gap-1.5">
                {boleto.status !== "pago" && <button type="button" onClick={() => onEditarValor(boleto)} className="rounded-lg px-2.5 py-1.5 text-[0.58rem] text-burgundy/55 hover:bg-blush hover:text-burgundy">Editar valor</button>}
                {boleto.status !== "pendente_confirmacao" && boleto.comprovante_url && <button type="button" onClick={() => onAbrir(boleto)} className="rounded-lg px-2.5 py-1.5 text-[0.58rem] text-burgundy/55 hover:bg-blush hover:text-burgundy">Ver comprovante</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModalValidarComprovante({ boleto, onClose, onResolvido }: { boleto: Boleto; onClose: () => void; onResolvido: () => void }) {
  const [multa, setMulta] = useState(String(DEFAULT_MULTA).replace(".", ","));
  const [jurosDia, setJurosDia] = useState(String(DEFAULT_JUROS_DIA).replace(".", ","));
  const [desconto, setDesconto] = useState("0");
  const [valorComprovante, setValorComprovante] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [processando, setProcessando] = useState(false);

  const dias = diasEmAtraso(boleto.data_vencimento);
  const calculo = calcularValorAtualizado(Number(boleto.valor), dias, Number(multa.replace(",", ".")) || 0, Number(jurosDia.replace(",", ".")) || 0, Number(desconto.replace(",", ".")) || 0);
  const valorPago = Number(valorComprovante.replace(/\./g, "").replace(",", "."));
  const temValorPago = Number.isFinite(valorPago) && valorComprovante.trim() !== "";
  const diferenca = temValorPago ? valorPago - calculo.total : null;
  const confere = diferenca !== null && Math.abs(diferenca) < 0.01;

  async function resolver(acao: "confirmar" | "rejeitar") {
    if (acao === "confirmar" && boleto.status === "pendente_confirmacao" && (!boleto.comprovante_url || !temValorPago || !confere)) {
      toast.error("Confira o comprovante e informe o valor pago. O valor precisa bater com o valor atualizado.");
      return;
    }
    setProcessando(true);
    try {
      const res = await fetch(`/api/admin/boletos/${boleto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, observacoes: observacoes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível atualizar o pagamento.");
      toast.success(acao === "confirmar" ? "Pagamento confirmado." : "Comprovante rejeitado.");
      onResolvido();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pagamento.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-burgundy-dark/55 p-3 backdrop-blur-md">
        <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-white/10 bg-[#1b181b] p-4 text-pearl shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-3"><div><p className="text-[0.62rem] uppercase tracking-[0.16em] text-gold">Validação financeira</p><h2 className="mt-1 text-lg font-semibold text-rose">Parcela {boleto.numero_parcela}/{boleto.total_parcelas}</h2><p className="text-xs text-pearl/45">{boleto.clientes?.nome_completo ?? "Cliente"} · vencimento {formatarData(boleto.data_vencimento)}</p></div><button onClick={onClose} className="rounded-full p-2 text-pearl/35 hover:bg-white/5 hover:text-pearl" aria-label="Fechar"><X className="h-4 w-4" /></button></div>

          {boleto.comprovante_url ? <a href={boleto.comprovante_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between rounded-xl border border-rose/15 bg-rose/[0.05] px-3 py-3 text-xs text-rose hover:bg-rose/[0.09]"><span className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Abrir comprovante para conferência</span><ExternalLink className="h-4 w-4" /></a> : <div className="mt-4 rounded-xl border border-alert/20 bg-alert/[0.05] px-3 py-3 text-xs text-alert">Nenhum comprovante foi anexado a esta parcela.</div>}

          <div className="mt-3 grid gap-2 sm:grid-cols-3"><ValorBox label="Valor original" valor={formatarMoeda(boleto.valor)} /><ValorBox label="Dias em atraso" valor={`${dias} dia${dias === 1 ? "" : "s"}`} alerta={dias > 0} /><ValorBox label="Total para quitar hoje" valor={formatarMoeda(calculo.total)} destaque /></div>

          {dias > 0 ? <div className="mt-3 rounded-2xl border border-alert/15 bg-alert/[0.035] p-3.5"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-alert"><Clock3 className="h-4 w-4" /> Atualização por atraso</div><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"><div><label className="mb-1 block text-[0.58rem] uppercase tracking-[0.12em] text-pearl/35">Multa (%)</label><Input value={multa} onChange={(e) => setMulta(e.target.value)} inputMode="decimal" /></div><div><label className="mb-1 block text-[0.58rem] uppercase tracking-[0.12em] text-pearl/35">Juros por dia (%)</label><Input value={jurosDia} onChange={(e) => setJurosDia(e.target.value)} inputMode="decimal" /></div><div><label className="mb-1 block text-[0.58rem] uppercase tracking-[0.12em] text-pearl/35">Desconto (%)</label><Input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" /></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-[0.62rem]"><div className="rounded-xl bg-white/[0.035] p-2"><p className="text-pearl/35">Multa</p><p className="mt-0.5 font-semibold">{formatarMoeda(calculo.multa)}</p></div><div className="rounded-xl bg-white/[0.035] p-2"><p className="text-pearl/35">Juros</p><p className="mt-0.5 font-semibold">{formatarMoeda(calculo.juros)}</p></div><div className="rounded-xl bg-white/[0.035] p-2"><p className="text-pearl/35">Desconto</p><p className="mt-0.5 font-semibold text-success">-{formatarMoeda(calculo.desconto)}</p></div></div></div> : <div className="mt-3 rounded-xl border border-success/15 bg-success/[0.035] px-3 py-2.5 text-xs text-success">Pagamento dentro do prazo: o valor de referência é {formatarMoeda(boleto.valor)}.</div>}

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3.5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-pearl"><WalletCards className="h-4 w-4 text-rose" /> Conferência do comprovante</div><label className="mb-1 block text-[0.58rem] uppercase tracking-[0.12em] text-pearl/35">Valor que aparece no comprovante</label><Input value={valorComprovante} onChange={(e) => setValorComprovante(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />{temValorPago && <div className={cn("mt-2 rounded-xl px-3 py-2.5 text-xs", confere ? "bg-success/10 text-success" : "bg-alert/10 text-alert")}>{confere ? "✓ Valor do comprovante confere com o valor que deve ser pago." : `Diferença: ${formatarMoeda(Math.abs(diferenca ?? 0))}. Confira antes de confirmar.`}</div>}<Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-2.5" placeholder="Observação da conferência (opcional)…" /></div>

          <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="button" variant="danger" loading={processando} onClick={() => resolver("rejeitar")}>Rejeitar</Button><Button type="button" loading={processando} onClick={() => resolver("confirmar")}><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar pagamento</Button></div>
        </div>
      </div>
    </Portal>
  );
}

function ValorBox({ label, valor, alerta, destaque }: { label: string; valor: string; alerta?: boolean; destaque?: boolean }) {
  return <div className={cn("rounded-xl border p-3", destaque ? "border-rose/20 bg-rose/[0.06]" : "border-white/8 bg-white/[0.025]")}><p className="text-[0.56rem] uppercase tracking-[0.13em] text-pearl/35">{label}</p><p className={cn("mt-1 text-sm font-bold", destaque ? "text-rose" : alerta ? "text-alert" : "text-pearl")}>{valor}</p></div>;
}
