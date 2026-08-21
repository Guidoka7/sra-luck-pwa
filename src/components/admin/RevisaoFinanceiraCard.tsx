"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, CreditCard, FileCheck2, Landmark, ShieldCheck, X } from "lucide-react";
import { Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";
import { PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS } from "@/types/database";

type Forma = "cartao" | "pix" | "cheques" | "boleto_100";
interface Pendente {
  id: string;
  nome: string;
  cpf: string;
  valorContrato: number;
  quantidadeParcelas: number | null;
  porcentagemPagamento: number;
  dataAtingiuPercentual: string | null;
  saldoRestanteEstimado: number;
}

const FORMAS: { value: Forma; label: string; description: string }[] = [
  { value: "cartao", label: "Cartão de crédito", description: "taxa configurada no contrato" },
  { value: "pix", label: "PIX", description: "sem taxa adicional" },
  { value: "cheques", label: "Cheques", description: "análise de até 5 dias úteis" },
  { value: "boleto_100", label: "100% boleto", description: "análise de até 5 dias úteis" },
];

function diasUteisDesde(iso: string | null) {
  if (!iso) return 0;
  const inicio = new Date(iso);
  const hoje = new Date();
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  let dias = 0;
  while (cursor < hoje) {
    cursor.setDate(cursor.getDate() + 1);
    const semana = cursor.getDay();
    if (semana !== 0 && semana !== 6) dias += 1;
  }
  return dias;
}

export function RevisaoFinanceiraCard() {
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [financeiro, setFinanceiro] = useState<Record<string, { saldo: string; taxa: string; formas: Forma[] }>>({});

  async function carregar() {
    try {
      const res = await fetch("/api/admin/liberacoes-financeiras", { cache: "no-store" });
      const revisao = await res.json();
      if (res.ok) {
        const lista = (revisao.pendentes ?? []) as Pendente[];
        setPendentes(lista);
        setFinanceiro((atual) =>
          Object.fromEntries(
            lista.map((p) => [
              p.id,
              atual[p.id] ?? {
                saldo: String(p.saldoRestanteEstimado ?? 0),
                taxa: "5.4",
                formas: ["cartao", "pix", "cheques", "boleto_100"] as Forma[],
              },
            ])
          )
        );
      }
    } catch {
      toast.error("Não foi possível carregar a fila de confirmação financeira.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30_000);
    return () => clearInterval(intervalo);
  }, []);

  function alterarFinanceiro(id: string, patch: Partial<{ saldo: string; taxa: string; formas: Forma[] }>) {
    setFinanceiro((atual) => ({
      ...atual,
      [id]: {
        ...(atual[id] ?? { saldo: "0", taxa: "5.4", formas: [] }),
        ...patch,
      },
    }));
  }

  function alternarForma(id: string, forma: Forma) {
    const atual = financeiro[id]?.formas ?? [];
    alterarFinanceiro(id, {
      formas: atual.includes(forma) ? atual.filter((f) => f !== forma) : [...atual, forma],
    });
  }

  async function decidir(id: string, decisao: "aprovada" | "recusada") {
    if (decisao === "recusada") {
      const motivo = window.prompt("Descreva rapidamente a divergência encontrada no levantamento financeiro (opcional):");
      if (motivo === null) return;
      await enviarDecisao(id, decisao, motivo);
      return;
    }

    const config = financeiro[id];
    if (!config || Number(config.saldo) < 0 || !Number.isFinite(Number(config.saldo))) {
      toast.error("Informe um saldo restante válido.");
      return;
    }
    if (!config.formas.length) {
      toast.error("Selecione pelo menos uma forma de custeio.");
      return;
    }
    await enviarDecisao(id, decisao, undefined, config);
  }

  async function enviarDecisao(
    id: string,
    decisao: "aprovada" | "recusada",
    observacao?: string,
    config?: { saldo: string; taxa: string; formas: Forma[] }
  ) {
    setProcessando(id);
    try {
      const body: Record<string, unknown> = { decisao, observacao: observacao || undefined };
      if (decisao === "aprovada" && config) {
        body.saldoRestante = Number(config.saldo);
        body.taxaCartao = Number(config.taxa);
        body.formasCusteio = config.formas;
      }

      const res = await fetch(`/api/admin/clientes/${id}/revisao-financeira`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.erro ?? "Não foi possível registrar a decisão.");
        return;
      }

      toast.success(
        decisao === "aprovada"
          ? "Levantamento confirmado, condições financeiras salvas e agenda liberada para a cliente."
          : "Revisão recusada. A cliente foi notificada de que há uma divergência."
      );
      setPendentes((atual) => atual.filter((p) => p.id !== id));
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setProcessando(null);
    }
  }

  if (carregando) return null;

  return (
    <div className="space-y-3">
      <Panel className="p-4 sm:p-5">
        <SectionHeading
          title="Confirmação do levantamento financeiro"
          description="Confirme o saldo e o custeio para liberar a agenda."
          aside={
            <StatusPill tone={pendentes.length > 0 ? "rose" : "neutral"}>
              {pendentes.length} pendente(s)
            </StatusPill>
          }
        />

        {pendentes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rose/20 bg-blush/30 px-5 py-6 text-center">
            <ShieldCheck className="h-5 w-5 text-clay/30" />
            <p className="text-sm text-clay/55">Nenhuma cliente aguardando confirmação financeira.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map((c) => {
              const config = financeiro[c.id] ?? {
                saldo: String(c.saldoRestanteEstimado ?? 0),
                taxa: "5.4",
                formas: ["cartao", "pix", "cheques", "boleto_100"] as Forma[],
              };
              const dias = diasUteisDesde(c.dataAtingiuPercentual);
              const atrasado = dias >= PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS;

              return (
                <div key={c.id} className="rounded-xl border border-rose/10 bg-blush/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-burgundy">{c.nome}</p>
                      <p className="text-[0.68rem] text-clay/50">
                        {formatarMoeda(c.valorContrato)} · {c.quantidadeParcelas ?? "—"} parcelas · {c.porcentagemPagamento}% pago
                      </p>
                    </div>
                    <p className={`flex items-center gap-1 text-[0.68rem] ${atrasado ? "text-alert" : "text-burgundy/60"}`}>
                      <Clock className="h-3 w-3" />
                      {atrasado ? "Prazo atingido" : `${dias}/${PRAZO_REVISAO_FINANCEIRA_DIAS_UTEIS} dias úteis`}
                    </p>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.5fr]">
                    <label className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-clay/45">
                      Saldo confirmado
                      <input
                        value={config.saldo}
                        onChange={(e) => alterarFinanceiro(c.id, { saldo: e.target.value })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-rose/15 bg-white px-2.5 py-2 text-sm text-burgundy outline-none focus:border-gold"
                      />
                    </label>
                    <label className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-clay/45">
                      Taxa cartão (%)
                      <input
                        value={config.taxa}
                        onChange={(e) => alterarFinanceiro(c.id, { taxa: e.target.value })}
                        type="number"
                        min="0"
                        step="0.1"
                        className="mt-1 w-full rounded-lg border border-rose/15 bg-white px-2.5 py-2 text-sm text-burgundy outline-none focus:border-gold"
                      />
                    </label>
                  </div>

                  <div className="mt-2">
                    <p className="mb-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-clay/45">Formas de custeio</p>
                    <div className="grid gap-1.5 sm:grid-cols-4">
                      {FORMAS.map((f) => (
                        <button
                          type="button"
                          key={f.value}
                          onClick={() => alternarForma(c.id, f.value)}
                          className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition ${
                            config.formas.includes(f.value)
                              ? "border-burgundy bg-burgundy/[0.06]"
                              : "border-rose/10 bg-white"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                              config.formas.includes(f.value) ? "bg-burgundy text-cream" : "bg-blush text-burgundy"
                            }`}
                          >
                            {f.value === "cartao" ? (
                              <CreditCard className="h-3 w-3" />
                            ) : f.value === "pix" ? (
                              <Landmark className="h-3 w-3" />
                            ) : (
                              <FileCheck2 className="h-3 w-3" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.68rem] font-semibold text-burgundy">{f.label}</span>
                            <span className="block truncate text-[0.56rem] text-clay/45">{f.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 p-2">
                    <p className="text-[0.68rem] text-clay/55">
                      Cartão com taxa: <strong className="text-burgundy">{formatarMoeda(Number(config.saldo || 0) * (1 + Number(config.taxa || 0) / 100))}</strong>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={processando === c.id}
                        onClick={() => decidir(c.id, "recusada")}
                        className="!text-alert"
                      >
                        <X className="h-3 w-3" /> Recusar
                      </Button>
                      <Button size="sm" loading={processando === c.id} onClick={() => decidir(c.id, "aprovada")}>
                        <Check className="h-3 w-3" /> Confirmar e liberar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
