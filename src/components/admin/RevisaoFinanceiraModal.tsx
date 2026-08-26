"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, FileText, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";
import type { Boleto } from "@/types/database";

type Forma = "cartao" | "pix" | "cheques" | "boleto_100";
const FORMAS: Array<{ value: Forma; label: string }> = [
  { value: "cartao", label: "Cartão" },
  { value: "pix", label: "PIX" },
  { value: "cheques", label: "Cheques" },
  { value: "boleto_100", label: "100% boleto" },
];

type ClienteFinanceiro = {
  nome_completo: string;
  telefone: string | null;
  valor_contrato: number;
  termos_assinados_em?: string | null;
  financeiro_saldo_restante?: number | null;
};

export function RevisaoFinanceiraModal({ clienteId, onClose, onConcluido }: { clienteId: string; onClose: () => void; onConcluido: () => void }) {
  const [cliente, setCliente] = useState<ClienteFinanceiro | null>(null);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [saldo, setSaldo] = useState("0");
  const [taxa, setTaxa] = useState("5.4");
  const [formas, setFormas] = useState<Forma[]>(["cartao", "pix", "cheques", "boleto_100"]);

  async function carregar() {
    setCarregando(true);
    try {
      const [rc, rb] = await Promise.all([
        fetch(`/api/admin/clientes/${clienteId}`, { cache: "no-store" }),
        fetch(`/api/admin/clientes/${clienteId}/boletos`, { cache: "no-store" }),
      ]);
      const dc = await rc.json();
      const db = await rb.json();
      if (!rc.ok) throw new Error(dc.erro ?? "Não foi possível carregar os dados da cliente.");
      if (!rb.ok) throw new Error(db.erro ?? "Não foi possível carregar as parcelas.");
      const c = dc.cliente as ClienteFinanceiro;
      const lista = (db.boletos ?? []) as Boleto[];
      setCliente(c);
      setBoletos(lista);
      setSaldo(String(c.financeiro_saldo_restante ?? lista.filter((b) => b.status !== "pago").reduce((s, b) => s + Number(b.valor || 0), 0)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar a revisão financeira.");
    } finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, [clienteId]);

  const pagas = useMemo(() => boletos.filter((b) => b.status === "pago"), [boletos]);
  const valorPago = pagas.reduce((s, b) => s + Number(b.valor || 0), 0);
  const valorRestante = boletos.filter((b) => b.status !== "pago").reduce((s, b) => s + Number(b.valor || 0), 0);
  const taxaNumero = Number(taxa.replace(",", ".")) || 0;
  const totalComTaxa = Number(saldo || 0) * (1 + taxaNumero / 100);

  function alternarForma(forma: Forma) { setFormas((atual) => atual.includes(forma) ? atual.filter((x) => x !== forma) : [...atual, forma]); }

  async function decidirParcela(boleto: Boleto, acao: "confirmar" | "rejeitar") {
    if (acao === "rejeitar") {
      const motivo = window.prompt(`Motivo da recusa da parcela ${boleto.numero_parcela}/${boleto.total_parcelas}:`, "Comprovante não está de acordo com o pagamento informado.");
      if (motivo === null) return;
      const observacoes = `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}: comprovante recusado. ${motivo.trim() || "Comprovante recusado pela administração."}`;
      setProcessando(boleto.id);
      try {
        const r = await fetch(`/api/admin/boletos/${boleto.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, observacoes }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Não foi possível recusar a parcela.");
        toast.success(`Parcela ${boleto.numero_parcela} recusada e devolvida para Em aberto.`);
        setBoletos((atual) => atual.map((b) => b.id === boleto.id ? { ...b, status: "nao_pago", data_pagamento: null, observacoes } : b));
        onConcluido();
      } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao recusar parcela."); }
      finally { setProcessando(null); }
      return;
    }
    setProcessando(boleto.id);
    try {
      const r = await fetch(`/api/admin/boletos/${boleto.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "confirmar", observacoes: boleto.comprovante_url ? "Pagamento confirmado após conferência administrativa." : "Pagamento confirmado sem comprovante anexado após conferência administrativa." }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível confirmar a parcela.");
      setBoletos((atual) => atual.map((b) => b.id === boleto.id ? { ...b, status: "pago", data_pagamento: new Date().toISOString().slice(0, 10), observacoes: d.boleto?.observacoes ?? b.observacoes } : b));
      toast.success(`Parcela ${boleto.numero_parcela} confirmada.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao confirmar parcela."); }
    finally { setProcessando(null); }
  }

  async function confirmarLevantamento() {
    if (!formas.length) return toast.error("Selecione pelo menos uma forma de custeio.");
    const saldoNumero = Number(saldo);
    if (!Number.isFinite(saldoNumero) || saldoNumero < 0) return toast.error("Informe um valor restante válido.");
    if (boletos.some((b) => b.status !== "pago")) return toast.error("Confirme ou regularize todas as parcelas antes de liberar a próxima etapa.");
    setProcessando("final");
    try {
      const r = await fetch(`/api/admin/clientes/${clienteId}/revisao-financeira`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisao: "aprovada", saldoRestante: saldoNumero, taxaCartao: taxaNumero, formasCusteio: formas }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível confirmar o levantamento financeiro.");
      toast.success("Levantamento confirmado. A próxima etapa foi liberada.");
      onConcluido();
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao confirmar levantamento."); }
    finally { setProcessando(null); }
  }

  return <Portal><div className="fixed inset-0 z-[70] flex items-center justify-center bg-burgundy-dark/60 p-2.5 backdrop-blur-md sm:p-4">
    <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1b181b] text-pearl shadow-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0"><p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-rose">Revisão financeira</p><h2 className="mt-0.5 truncate font-heading text-base font-semibold text-pearl">{cliente?.nome_completo ?? "Carregando cliente…"}</h2></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-pearl/35 hover:bg-white/5"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {carregando ? <div className="p-10 text-center text-xs text-pearl/40">Carregando dados, parcelas e comprovantes…</div> : <div className="space-y-3">
          <section className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5"><p className="text-[0.48rem] uppercase tracking-label text-pearl/35">Telefone</p><p className="mt-1 text-[0.68rem] font-semibold text-pearl/85">{cliente?.telefone || "Não informado"}</p></div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5"><p className="text-[0.48rem] uppercase tracking-label text-pearl/35">Carta de crédito</p><p className="mt-1 text-[0.68rem] font-semibold text-pearl/85">{formatarMoeda(Number(cliente?.valor_contrato || 0))}</p></div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5"><p className="text-[0.48rem] uppercase tracking-label text-pearl/35">Termos</p><p className="mt-1 text-[0.68rem] font-semibold text-pearl/85">{cliente?.termos_assinados_em ? "Assinados" : "Ainda não assinados"}</p></div>
            <div className="rounded-xl border border-success/15 bg-success/[0.045] p-2.5"><p className="text-[0.48rem] uppercase tracking-label text-success/70">Pagamento</p><p className="mt-1 text-[0.68rem] font-semibold text-pearl/85">{pagas.length}/{boletos.length} parcelas · {formatarMoeda(valorPago)} pagos</p></div>
          </section>

          <section className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-rose">Parcelas e comprovantes</p><p className="mt-0.5 text-[0.58rem] text-pearl/35">Confira cada parcela. Comprovantes anexados ficam disponíveis para visualização e recusa.</p></div><span className={`rounded-full px-2 py-1 text-[0.52rem] font-bold ${boletos.every((b) => b.status === "pago") ? "bg-success/10 text-success" : "bg-gold/10 text-gold"}`}>{pagas.length}/{boletos.length} confirmadas</span></div>
            <div className="mt-2 overflow-hidden rounded-lg border border-white/8">
              {boletos.map((b) => <div key={b.id} className="grid grid-cols-[46px_1fr_auto] items-center gap-2 border-b border-white/6 px-2.5 py-2 last:border-0">
                <span className="text-[0.6rem] font-semibold text-pearl/60">{b.numero_parcela}/{b.total_parcelas}</span>
                <div className="min-w-0"><div className="flex flex-wrap gap-x-2 text-[0.6rem]"><span className="text-pearl/45">{b.data_vencimento?.split("-").reverse().join("/") ?? "—"}</span><strong className="text-pearl/85">{formatarMoeda(Number(b.valor))}</strong></div><p className={`mt-0.5 text-[0.5rem] ${b.status === "pago" ? "text-success" : "text-pearl/35"}`}>{b.status === "pago" ? "Pagamento confirmado" : "Em aberto"}{b.comprovante_url ? " · comprovante anexado" : " · sem comprovante"}</p></div>
                <div className="flex items-center gap-1">
                  {b.comprovante_url && <a href={`/api/admin/boletos/${b.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-md bg-rose/10 text-rose" title="Ver comprovante"><FileText className="h-3.5 w-3.5" /></a>}
                  {b.status !== "pago" && <Button size="sm" loading={processando === b.id} onClick={() => decidirParcela(b, "confirmar")} className="!h-7 !px-2 !text-[0.55rem]"><Check className="h-3 w-3" />Aprovar</Button>}
                  {b.comprovante_url && <button type="button" disabled={processando === b.id} onClick={() => decidirParcela(b, "rejeitar")} className="flex h-7 items-center gap-1 rounded-md bg-alert/10 px-2 text-[0.55rem] font-semibold text-alert disabled:opacity-40"><X className="h-3 w-3" />Recusar</button>}
                </div>
              </div>)}
            </div>
          </section>

          <section className="rounded-xl border border-gold/15 bg-gold/[0.045] p-3">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold"/><div><p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold">Custeio do valor restante</p><p className="text-[0.58rem] text-pearl/35">{boletos.length - pagas.length} parcelas restantes · {formatarMoeda(valorRestante)}</p></div></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-[0.52rem] font-bold uppercase tracking-label text-pearl/40">Valor restante<input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs text-pearl outline-none" /></label><label className="text-[0.52rem] font-bold uppercase tracking-label text-pearl/40">Taxa cartão (%)<input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs text-pearl outline-none" /></label></div>
            <div className="mt-2"><p className="mb-1.5 text-[0.52rem] font-bold uppercase tracking-label text-pearl/40">Formas de custeio disponíveis</p><div className="flex flex-wrap gap-1.5">{FORMAS.map((f) => <button type="button" key={f.value} onClick={() => alternarForma(f.value)} className={`rounded-full border px-2.5 py-1.5 text-[0.56rem] font-semibold transition ${formas.includes(f.value) ? "border-rose/30 bg-rose text-white" : "border-white/10 bg-white/[0.04] text-pearl/60"}`}>{f.label}</button>)}</div></div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/10 px-2.5 py-2"><p className="text-[0.56rem] text-pearl/45">Total com taxa de cartão: <strong className="text-pearl/80">{formatarMoeda(totalComTaxa)}</strong></p><Button size="sm" loading={processando === "final"} onClick={confirmarLevantamento} disabled={boletos.length === 0 || boletos.some((b) => b.status !== "pago")}><CheckCircle2 className="h-3.5 w-3.5" />Confirmar levantamento</Button></div>
          </section>
        </div>}
      </div>
    </div>
  </div></Portal>;
}
