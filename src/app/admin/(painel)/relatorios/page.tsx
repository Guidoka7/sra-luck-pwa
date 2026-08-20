"use client";
import { fetchInstant, refreshInstant, getInstantCache } from "@/lib/instantCache";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatarMoeda } from "@/lib/utils";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";

interface ClienteDoMes {
  agendamentoId: string;
  nome: string;
  responsavel: string | null;
  statusFinanceiro: "pago" | "a_pagar" | "parcial";
  statusCirurgia: "nao_agendada" | "agendada" | "realizada" | "cancelada";
  valorContrato: number;
  data: string | null;
}

interface MesAgenda {
  mes: number;
  nome: string;
  total: number;
  clientes: ClienteDoMes[];
}

interface RelatorioData {
  ano: number;
  meses: MesAgenda[];
  anosDisponiveis: number[];
  opcoesFiltro: { responsaveis: string[] };
}

export default function RelatoriosPage() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dados, setDados] = useState<RelatorioData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mesesAbertos, setMesesAbertos] = useState<Set<number>>(new Set());

  useEffect(() => {
    let ativo = true;
    const url = `/api/admin/agenda-mensal?ano=${ano}`;
    const cached = getInstantCache<RelatorioData>(url);
    if (cached) {
      setDados(cached);
      setMesesAbertos(new Set(cached.meses.filter((mesAtual) => mesAtual.total > 0).map((mesAtual) => mesAtual.mes)));
      setCarregando(false);
    } else {
      setCarregando(true);
    }
    fetchInstant<RelatorioData>(url).then((data) => {
      if (!ativo) return;
      setDados(data);
      setMesesAbertos(new Set(data.meses.filter((mesAtual) => mesAtual.total > 0).map((mesAtual) => mesAtual.mes)));
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [ano]);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios por período"
        description="Agendamentos confirmados organizados por mês."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-rose/12 bg-white/90 p-1 shadow-card">
            <button
              onClick={() => setAno((a) => a - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
              aria-label="Ano anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-16 text-center text-sm font-medium text-burgundy">{ano}</span>
            <button
              onClick={() => setAno((a) => a + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
              aria-label="Próximo ano"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {carregando || !dados ? (
        <SkeletonRows count={4} />
      ) : (
        <Panel className="p-4">
          <SectionHeading title="Detalhamento mensal" description="Cada mês em sua própria camada de leitura." />
          <div className="space-y-1.5">
            {dados.meses.map((mesAtual) => {
              const aberto = mesesAbertos.has(mesAtual.mes);
              return (
                <div key={mesAtual.mes} className="overflow-hidden rounded-xl border border-rose/10 bg-blush/20">
                  <button
                    onClick={() =>
                      setMesesAbertos((atual) => {
                        const novo = new Set(atual);
                        if (novo.has(mesAtual.mes)) novo.delete(mesAtual.mes);
                        else novo.add(mesAtual.mes);
                        return novo;
                      })
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-blush/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-burgundy">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-[0.82rem] font-medium text-burgundy">{mesAtual.nome}</p>
                        <p className="text-[0.68rem] text-clay/50">{mesAtual.total} cliente{mesAtual.total === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-burgundy/50 transition-transform ${aberto ? "rotate-180" : ""}`} />
                  </button>

                  {aberto ? (
                    <div className="space-y-1.5 border-t border-rose/10 px-3 py-2.5">
                      {mesAtual.total === 0 ? (
                        <div className="rounded-lg border border-dashed border-rose/15 bg-white/60 px-3 py-4 text-center text-[0.68rem] text-clay/45">
                          Nenhuma cliente confirmada neste mês.
                        </div>
                      ) : (
                        mesAtual.clientes.map((item) => (
                          <div
                            key={item.agendamentoId}
                            className="grid gap-2 rounded-lg border border-rose/10 bg-white/70 p-2.5 lg:grid-cols-[1.4fr_0.65fr_0.85fr_0.55fr] lg:items-center"
                          >
                            <div>
                              <p className="text-[0.82rem] font-medium text-burgundy">{item.nome}</p>
                              <p className="mt-0.5 text-[0.68rem] text-clay/50">
                                {item.responsavel ? `Responsável: ${item.responsavel}` : "Sem responsável vinculado"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[0.65rem] uppercase tracking-label text-clay/35">Data</p>
                              <p className="mt-0.5 text-xs text-burgundy">{item.data ? item.data.split("-").reverse().join("/") : "Sem data"}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <StatusPill tone={item.statusFinanceiro === "pago" ? "success" : item.statusFinanceiro === "parcial" ? "gold" : "alert"}>
                                {item.statusFinanceiro === "pago" ? "Pago" : item.statusFinanceiro === "parcial" ? "Parcial" : "A pagar"}
                              </StatusPill>
                              <StatusPill tone={item.statusCirurgia === "realizada" ? "success" : item.statusCirurgia === "cancelada" ? "alert" : "rose"}>
                                {item.statusCirurgia === "realizada"
                                  ? "Concluído"
                                  : item.statusCirurgia === "cancelada"
                                    ? "Cancelado"
                                    : "Agendado"}
                              </StatusPill>
                            </div>
                            <div>
                              <p className="text-[0.65rem] uppercase tracking-label text-clay/35">Contrato</p>
                              <p className="mt-0.5 text-[0.72rem] font-medium text-burgundy">{formatarMoeda(item.valorContrato)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
