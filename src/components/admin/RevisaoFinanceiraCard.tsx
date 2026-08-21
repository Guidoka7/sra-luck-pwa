"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, CreditCard, FileCheck2, Landmark, ShieldCheck, X } from "lucide-react";
import { Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";
import { PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS } from "@/types/database";

type Forma = "cartao" | "pix" | "cheques" | "boleto_100";
interface Pendente { id: string; nome: string; cpf: string; valorContrato: number; quantidadeParcelas: number | null; porcentagemPagamento: number; dataAtingiuPercentual: string | null; saldoRestanteEstimado: number; }
interface Solicitacao { id: string; cliente_id: string; agendamento_id: string | null; forma_custeio: Forma; saldo_restante: number; taxa_cartao: number; total_com_taxa: number; status: "pendente" | "em_analise" | "aprovada"; created_at: string; observacao: string | null; data_termos?: string | null; previsao_sugerida?: string | null; clientes?: { nome_completo: string; cpf: string; quantidade_parcelas: number | null }; }
const FORMAS: { value: Forma; label: string; description: string }[] = [
  { value: "cartao", label: "Cartão de crédito", description: "taxa configurada no contrato" },
  { value: "pix", label: "PIX", description: "sem taxa adicional" },
  { value: "cheques", label: "Cheques", description: "análise de até 5 dias úteis" },
  { value: "boleto_100", label: "100% boleto", description: "análise de até 5 dias úteis" },
];
function diasUteisDesde(iso: string | null) { if (!iso) return 0; const inicio = new Date(iso); const hoje = new Date(); const cursor = new Date(inicio); cursor.setHours(0,0,0,0); hoje.setHours(0,0,0,0); let dias = 0; while (cursor < hoje) { cursor.setDate(cursor.getDate()+1); const semana = cursor.getDay(); if (semana !== 0 && semana !== 6) dias += 1; } return dias; }
function data90Dias(iso: string | null | undefined) { if (!iso) return ""; const [a,m,d] = iso.split("-").map(Number); if (!a || !m || !d) return ""; const data = new Date(a, m-1, d); data.setDate(data.getDate()+90); return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`; }

export function RevisaoFinanceiraCard() {
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [financeiro, setFinanceiro] = useState<Record<string, { saldo: string; taxa: string; formas: Forma[] }>>({});
  const [datasLiberacao, setDatasLiberacao] = useState<Record<string, string>>({});

  async function carregar() {
    try {
      const [resRevisao, resSolicitacoes] = await Promise.all([
        fetch("/api/admin/liberacoes-financeiras", { cache: "no-store" }),
        fetch("/api/admin/solicitacoes-liberacao-financeira", { cache: "no-store" }),
      ]);
      const revisao = await resRevisao.json(); const pedidos = await resSolicitacoes.json();
      if (resRevisao.ok) {
        const lista = revisao.pendentes ?? [];
        setPendentes(lista);
        setFinanceiro((atual) => Object.fromEntries(lista.map((p: Pendente) => [p.id, atual[p.id] ?? { saldo: String(p.saldoRestanteEstimado ?? 0), taxa: "5.4", formas: ["cartao", "pix", "cheques", "boleto_100"] }] )));
      }
      if (resSolicitacoes.ok) {
        const lista = pedidos.solicitacoes ?? [];
        setSolicitacoes(lista);
        setDatasLiberacao((atual) => Object.fromEntries(lista.map((s: Solicitacao) => [s.id, atual[s.id] ?? s.previsao_sugerida ?? data90Dias(s.data_termos)])));
      }
    } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); const intervalo = setInterval(carregar, 30_000); return () => clearInterval(intervalo); }, []);

  function alterarFinanceiro(id: string, patch: Partial<{ saldo: string; taxa: string; formas: Forma[] }>) { setFinanceiro((atual) => ({ ...atual, [id]: { ...(atual[id] ?? { saldo: "0", taxa: "5.4", formas: [] }), ...patch } })); }
  function alternarForma(id: string, forma: Forma) { const atual = financeiro[id]?.formas ?? []; alterarFinanceiro(id, { formas: atual.includes(forma) ? atual.filter((f) => f !== forma) : [...atual, forma] }); }

  async function decidir(id: string, decisao: "aprovada" | "recusada") {
    if (decisao === "recusada") { const motivo = window.prompt("Descreva rapidamente a divergência encontrada no levantamento financeiro (opcional):"); if (motivo === null) return; await enviarDecisao(id, decisao, motivo); return; }
    const config = financeiro[id];
    if (!config || Number(config.saldo) < 0 || !Number.isFinite(Number(config.saldo))) { toast.error("Informe um saldo restante válido."); return; }
    if (!config.formas.length) { toast.error("Selecione pelo menos uma forma de custeio."); return; }
    await enviarDecisao(id, decisao, undefined, config);
  }
  async function enviarDecisao(id: string, decisao: "aprovada" | "recusada", observacao?: string, config?: { saldo: string; taxa: string; formas: Forma[] }) {
    setProcessando(id);
    try {
      const body: Record<string, unknown> = { decisao, observacao: observacao || undefined };
      if (decisao === "aprovada" && config) { body.saldoRestante = Number(config.saldo); body.taxaCartao = Number(config.taxa); body.formasCusteio = config.formas; }
      const res = await fetch(`/api/admin/clientes/${id}/revisao-financeira`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.erro ?? "Não foi possível registrar a decisão."); return; }
      toast.success(decisao === "aprovada" ? "Levantamento confirmado, condições financeiras salvas e agenda liberada para a cliente." : "Revisão recusada. A cliente foi notificada de que há uma divergência.");
      setPendentes((atual) => atual.filter((p) => p.id !== id));
    } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setProcessando(null); }
  }

  async function atualizarSolicitacao(id: string, status: "em_analise" | "aprovada" | "recusada") {
    setProcessando(id); try {
      const res = await fetch("/api/admin/solicitacoes-liberacao-financeira", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const data = await res.json(); if (!res.ok) { toast.error(data.erro ?? "Não foi possível atualizar a solicitação."); return; }
      toast.success(status === "aprovada" ? "Custeio aprovado." : status === "recusada" ? "Solicitação recusada." : "Solicitação movida para análise.");
      await carregar();
    } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setProcessando(null); }
  }
  async function programar(id: string) {
    const data = datasLiberacao[id]; if (!data) { toast.error("Defina uma data de liberação."); return; }
    setProcessando(id); try {
      const res = await fetch("/api/admin/solicitacoes-liberacao-financeira", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, dataLiberacaoFinanceira: data, status: "aprovada" }) });
      const result = await res.json(); if (!res.ok) { toast.error(result.erro ?? "Não foi possível programar a liberação."); return; }
      toast.success("Data de liberação financeira programada. A cliente já verá a atualização no app."); await carregar();
    } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setProcessando(null); }
  }

  const aguardandoProgramacao = useMemo(() => solicitacoes.filter((s) => !s.agendamento_id || !s.data_termos), [solicitacoes]);
  if (carregando) return null;
  return <div className="space-y-5">
    <Panel className="p-6">
      <SectionHeading title="Confirmação do levantamento financeiro" description="Quando o percentual de parcelas pagas do contrato é atingido, a cliente entra nesta fila. Confirme o saldo real e as formas de custeio para liberar a agenda." aside={<StatusPill tone={pendentes.length > 0 ? "rose" : "neutral"}>{pendentes.length} pendente(s)</StatusPill>} />
      {pendentes.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-[28px] border border-dashed border-rose/20 bg-blush/30 px-6 py-10 text-center"><ShieldCheck className="h-6 w-6 text-clay/30" /><p className="text-sm text-clay/55">Nenhuma cliente aguardando confirmação financeira.</p></div> : <div className="space-y-4">{pendentes.map((c) => { const config = financeiro[c.id] ?? { saldo: String(c.saldoRestanteEstimado ?? 0), taxa: "5.4", formas: ["cartao", "pix", "cheques", "boleto_100"] as Forma[] }; const dias = diasUteisDesde(c.dataAtingiuPercentual); const atrasado = dias >= PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS; return <div key={c.id} className="rounded-[26px] border border-rose/10 bg-blush/30 p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base text-burgundy">{c.nome}</p><p className="text-xs text-clay/45">{formatarMoeda(c.valorContrato)} · {c.quantidadeParcelas ?? "—"} parcelas · {c.porcentagemPagamento}% pago</p></div><p className={`flex items-center gap-1.5 text-xs ${atrasado ? "text-alert" : "text-burgundy/60"}`}><Clock className="h-3.5 w-3.5" />{atrasado ? "Prazo de análise atingido" : `${dias}/${PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS} dias úteis`}</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.55fr]"><label className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-clay/45">Saldo restante confirmado<input value={config.saldo} onChange={(e) => alterarFinanceiro(c.id, { saldo: e.target.value })} type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-xl border border-rose/15 bg-white px-3 py-2.5 text-sm text-burgundy outline-none focus:border-gold" /></label><label className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-clay/45">Taxa cartão (%)<input value={config.taxa} onChange={(e) => alterarFinanceiro(c.id, { taxa: e.target.value })} type="number" min="0" step="0.1" className="mt-1.5 w-full rounded-xl border border-rose/15 bg-white px-3 py-2.5 text-sm text-burgundy outline-none focus:border-gold" /></label></div>
        <div className="mt-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-clay/45">Formas de custeio disponíveis para este contrato</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{FORMAS.map((f) => <button type="button" key={f.value} onClick={() => alternarForma(c.id, f.value)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${config.formas.includes(f.value) ? "border-burgundy bg-burgundy/[0.06]" : "border-rose/10 bg-white"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full ${config.formas.includes(f.value) ? "bg-burgundy text-cream" : "bg-blush text-burgundy"}`}>{f.value === "cartao" ? <CreditCard className="h-3.5 w-3.5" /> : f.value === "pix" ? <Landmark className="h-3.5 w-3.5" /> : <FileCheck2 className="h-3.5 w-3.5" />}</span><span><span className="block text-xs font-semibold text-burgundy">{f.label}</span><span className="block text-[0.62rem] text-clay/50">{f.description}</span></span></button>)}</div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 p-3"><p className="text-xs text-clay/55">Cartão com taxa: <strong className="text-burgundy">{formatarMoeda(Number(config.saldo || 0) * (1 + Number(config.taxa || 0) / 100))}</strong></p><div className="flex items-center gap-2"><Button size="sm" variant="secondary" loading={processando === c.id} onClick={() => decidir(c.id, "recusada")} className="!text-alert"><X className="h-3.5 w-3.5" /> Recusar</Button><Button size="sm" loading={processando === c.id} onClick={() => decidir(c.id, "aprovada")}><Check className="h-3.5 w-3.5" /> Confirmar e liberar agenda</Button></div></div>
      </div>; })}</div>}
    </Panel>

    <Panel className="p-6">
      <SectionHeading title="Solicitações de liberação financeira" description="Depois de escolher o custeio, a cliente volta para esta fila. Se ela já escolheu os termos, a data de liberação pode ser programada aqui." aside={<StatusPill tone={solicitacoes.length > 0 ? "rose" : "neutral"}>{solicitacoes.length} solicitação(ões)</StatusPill>} />
      {solicitacoes.length === 0 ? <div className="flex items-center justify-center rounded-[28px] border border-dashed border-rose/20 bg-blush/30 px-6 py-8 text-center"><p className="text-sm text-clay/55">Nenhuma solicitação de custeio aguardando análise.</p></div> : <div className="space-y-3">{solicitacoes.map((s) => { const forma = FORMAS.find((f) => f.value === s.forma_custeio); const dataSugestao = s.previsao_sugerida ?? data90Dias(s.data_termos); const dataAtual = datasLiberacao[s.id] ?? dataSugestao ?? ""; return <div key={s.id} className="rounded-[26px] border border-rose/10 bg-blush/30 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base text-burgundy">{s.clientes?.nome_completo ?? "Cliente"}</p><p className="text-xs text-clay/45">{forma?.label ?? s.forma_custeio} · {s.agendamento_id ? `termos em ${s.data_termos ? new Date(`${s.data_termos}T12:00:00`).toLocaleDateString("pt-BR") : "data definida"}` : "aguardando data dos termos"}</p><p className="mt-1 text-[0.68rem] text-clay/50">Saldo: {formatarMoeda(Number(s.saldo_restante))}{s.forma_custeio === "cartao" ? ` · total com taxa: ${formatarMoeda(Number(s.total_com_taxa))}` : ""}</p></div><StatusPill tone={s.status === "pendente" ? "rose" : "neutral"}>{s.status === "pendente" ? "Nova" : s.status === "em_analise" ? "Em análise" : "Aprovada"}</StatusPill></div>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" loading={processando === s.id} onClick={() => atualizarSolicitacao(s.id, "em_analise")}><Clock className="h-3.5 w-3.5" /> Em análise</Button><Button size="sm" variant="secondary" loading={processando === s.id} onClick={() => atualizarSolicitacao(s.id, "recusada")} className="!text-alert"><X className="h-3.5 w-3.5" /> Recusar</Button>{!s.agendamento_id ? <span className="self-center text-xs text-clay/45">Aguardando a cliente escolher a data dos termos.</span> : <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 p-1.5"><input type="date" value={dataAtual} min={s.data_termos ?? undefined} onChange={(e) => setDatasLiberacao((atual) => ({ ...atual, [s.id]: e.target.value }))} className="rounded-lg border border-rose/15 bg-white px-2.5 py-2 text-xs text-burgundy outline-none focus:border-gold" /><Button size="sm" loading={processando === s.id} onClick={() => programar(s.id)}><Check className="h-3.5 w-3.5" /> Programar liberação</Button>{dataSugestao && <span className="text-[0.62rem] text-clay/45">Sugestão: 90 dias após os termos</span>}</div>}</div>
        {s.observacao && <p className="mt-3 rounded-xl bg-gold/[0.07] p-3 text-xs leading-relaxed text-clay/60">{s.observacao}</p>}
      </div>; })}</div>}
    </Panel>
  </div>;
}
