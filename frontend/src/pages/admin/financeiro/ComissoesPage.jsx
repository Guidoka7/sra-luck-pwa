// Página: Comissões (somente exibição — lógica real preservada)
import React from "react";
import { useComissoes } from "../../../features/financeiro/hooks/useFinanceiro";
import { formatCurrency } from "../../../features/financeiro/utils/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

const STATUS = {
  liberada: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Liberada" },
  paga: { className: "bg-sky-50 text-sky-700 border-sky-200", label: "Paga" },
  aguardando_recebimento: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "Aguardando recebimento" },
  cancelada: { className: "bg-slate-100 text-slate-600 border-slate-200", label: "Cancelada" },
};

export default function ComissoesPage() {
  const { data, loading } = useComissoes();
  const total = (data || []).reduce((s, c) => s + c.valor, 0);
  const liberadas = (data || []).filter((c) => c.status === "liberada" || c.status === "paga").reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          A lógica real de cálculo e pagamento das comissões do Sra. Luck permanece inalterada nesta etapa. Esta tela apenas exibe o relacionamento entre parcelas e comissões.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total geral" value={formatCurrency(total)} />
        <Stat label="Liberadas / Pagas" value={formatCurrency(liberadas)} accent="text-emerald-700" />
        <Stat label="Quantidade" value={(data || []).length.toString()} />
        <Stat label="Aguardando" value={((data || []).filter((c) => c.status === "aguardando_recebimento").length).toString()} accent="text-amber-700" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Vendedora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Carregando…</TableCell></TableRow>}
            {(data || []).map((c) => {
              const s = STATUS[c.status] || STATUS.aguardando_recebimento;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-900">{c.vendedora}</TableCell>
                  <TableCell className="text-sm text-slate-700">{c.clienteNome}</TableCell>
                  <TableCell className="text-center text-sm">{c.percentual}%</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(c.valor)}</TableCell>
                  <TableCell><Badge variant="outline" className={s.className}>{s.label}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const Stat = ({ label, value, accent = "text-slate-900" }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xl font-semibold tabular-nums mt-1 ${accent}`}>{value}</div>
  </div>
);
