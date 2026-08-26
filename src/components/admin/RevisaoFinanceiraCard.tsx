"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatusPill } from "@/components/admin/ExecutiveUI";
import { formatarMoeda } from "@/lib/utils";
import { PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS } from "@/types/database";
import { RevisaoFinanceiraModal } from "@/components/admin/RevisaoFinanceiraModal";

type Pendente = { id: string; nome: string; cpf: string; valorContrato: number; quantidadeParcelas: number | null; porcentagemPagamento: number; dataAtingiuPercentual: string | null; saldoRestanteEstimado: number };
function diasUteisDesde(iso: string | null) { if (!iso) return 0; const inicio = new Date(iso); const hoje = new Date(); inicio.setHours(0,0,0,0); hoje.setHours(0,0,0,0); let dias = 0; while (inicio < hoje) { inicio.setDate(inicio.getDate()+1); const d = inicio.getDay(); if (d !== 0 && d !== 6) dias++; } return dias; }

export function RevisaoFinanceiraCard() {
  const [pendentes, setPendentes] = useState<Pendente[]>([]); const [busca, setBusca] = useState(""); const [carregando, setCarregando] = useState(true); const [clienteAberta, setClienteAberta] = useState<string | null>(null);
  async function carregar() { try { const res = await fetch("/api/admin/liberacoes-financeiras", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.erro ?? "Falha ao carregar a fila financeira."); setPendentes((data.pendentes ?? []) as Pendente[]); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível carregar a fila financeira."); } finally { setCarregando(false); } }
  useEffect(() => { void carregar(); const intervalo = setInterval(() => void carregar(), 30000); return () => clearInterval(intervalo); }, []);
  const filtradas = useMemo(() => { const termo = busca.trim().toLocaleLowerCase("pt-BR"); return pendentes.filter((p) => !termo || p.nome.toLocaleLowerCase("pt-BR").includes(termo)); }, [pendentes, busca]);
  if (carregando) return null;
  return <>
    <Panel className="p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-rose">Confirmação financeira</p><p className="mt-0.5 text-xs text-clay/50">Clique na cliente para conferir parcelas, comprovantes e definir o custeio.</p></div><StatusPill tone={filtradas.length ? "rose" : "neutral"}>{filtradas.length} pendente(s)</StatusPill></div>
      <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/35" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome…" className="h-9 w-full rounded-xl border border-rose/10 bg-[rgb(var(--surface-2))] pl-9 pr-3 text-xs text-burgundy outline-none placeholder:text-clay/35 focus:border-rose/25 focus:ring-1 focus:ring-rose/10" /></div>
      {filtradas.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-rose/15 bg-blush/15 px-4 py-5 text-center"><ShieldCheck className="mx-auto h-5 w-5 text-clay/25" /><p className="mt-1 text-xs text-clay/50">Nenhuma cliente aguardando confirmação financeira.</p></div> : <div className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {filtradas.map((c) => { const dias = diasUteisDesde(c.dataAtingiuPercentual); const atrasado = dias >= PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS; return <button key={c.id} type="button" onClick={() => setClienteAberta(c.id)} className="flex w-full items-center gap-2.5 rounded-xl border border-rose/8 bg-[rgb(var(--surface-2))] px-3 py-2.5 text-left transition hover:border-rose/20 hover:bg-blush/15">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blush/45 text-burgundy"><FileCheck2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-burgundy">{c.nome}</span><span className="mt-0.5 block truncate text-[0.58rem] text-clay/45">{formatarMoeda(c.valorContrato)} · {c.quantidadeParcelas ?? "—"} parcelas · {c.porcentagemPagamento}% pago</span></span><span className={`hidden shrink-0 items-center gap-1 text-[0.55rem] sm:flex ${atrasado ? "text-alert" : "text-clay/45"}`}><Clock className="h-3 w-3" />{atrasado ? "Prazo atingido" : `${dias}/${PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS} úteis`}</span><ChevronRight className="h-4 w-4 shrink-0 text-clay/30" />
        </button>; })}
      </div>}
    </Panel>
    {clienteAberta && <RevisaoFinanceiraModal clienteId={clienteAberta} onClose={() => setClienteAberta(null)} onConcluido={() => void carregar()} />}
  </>;
}
