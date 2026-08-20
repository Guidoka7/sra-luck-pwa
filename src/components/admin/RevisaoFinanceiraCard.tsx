"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, ShieldCheck, X } from "lucide-react";
import { Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";
import { PRAZO_REVISAO_FINANCEIRA_HORAS } from "@/types/database";

interface Pendente {
  id: string;
  nome: string;
  cpf: string;
  valorContrato: number;
  quantidadeParcelas: number | null;
  porcentagemPagamento: number;
  dataAtingiuPercentual: string | null;
}

function horasDesde(iso: string | null) {
  if (!iso) return 0;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
}

export function RevisaoFinanceiraCard() {
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/admin/liberacoes-financeiras");
      const data = await res.json();
      if (res.ok) setPendentes(data.pendentes ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => carregar(), 60_000);
    return () => clearInterval(intervalo);
  }, []);

  async function decidir(id: string, decisao: "aprovada" | "recusada") {
    if (decisao === "recusada") {
      const motivo = window.prompt(
        "Descreva rapidamente a divergência encontrada no levantamento financeiro (opcional):"
      );
      if (motivo === null) return; // cancelou o prompt
      await enviarDecisao(id, decisao, motivo);
      return;
    }
    await enviarDecisao(id, decisao);
  }

  async function enviarDecisao(id: string, decisao: "aprovada" | "recusada", observacao?: string) {
    setProcessando(id);
    try {
      const res = await fetch(`/api/admin/clientes/${id}/revisao-financeira`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, observacao: observacao || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.erro ?? "Não foi possível registrar a decisão.");
        return;
      }
      toast.success(
        decisao === "aprovada"
          ? "Agenda liberada para a cliente."
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
    <Panel className="p-6">
      <SectionHeading
        title="Confirmação de agenda cirúrgica"
        description="Clientes que atingiram o percentual de pagamento necessário e aguardam a confirmação do levantamento financeiro pra liberar a agenda dos termos cirúrgicos."
        aside={<StatusPill tone={pendentes.length > 0 ? "rose" : "neutral"}>{pendentes.length} pendente(s)</StatusPill>}
      />

      {pendentes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[28px] border border-dashed border-rose/20 bg-blush/30 px-6 py-10 text-center">
          <ShieldCheck className="h-6 w-6 text-clay/30" />
          <p className="text-sm text-clay/55">Nenhuma cliente aguardando confirmação de agenda cirúrgica no momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.map((c) => {
            const horas = horasDesde(c.dataAtingiuPercentual);
            const restante = Math.max(0, PRAZO_REVISAO_FINANCEIRA_HORAS - horas);
            const atrasado = restante === 0 && horas > 0;
            return (
              <div
                key={c.id}
                className="grid gap-4 rounded-[26px] border border-rose/10 bg-blush/30 p-4 lg:grid-cols-[1.3fr_0.8fr_0.9fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base text-burgundy">{c.nome}</p>
                  <p className="text-xs text-clay/45">{formatarMoeda(c.valorContrato)} · {c.quantidadeParcelas ?? "—"}x</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-clay/40">Pagamento</p>
                  <p className="mt-1 text-sm font-semibold text-burgundy">{c.porcentagemPagamento}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-clay/40">Prazo (72h)</p>
                  <p className={`mt-1 flex items-center gap-1.5 text-sm ${atrasado ? "text-alert" : "text-burgundy"}`}>
                    <Clock className="h-3.5 w-3.5" />
                    {atrasado ? "Prazo estourado" : `${restante}h restantes`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={processando === c.id}
                    onClick={() => decidir(c.id, "recusada")}
                    className="!text-alert"
                  >
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  <Button size="sm" loading={processando === c.id} onClick={() => decidir(c.id, "aprovada")}>
                    <Check className="h-3.5 w-3.5" /> Confirmar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
