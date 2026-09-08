// Página: Visão geral do Financeiro (dashboard).
import React from "react";
import { useVisaoGeral } from "../../../features/financeiro/hooks/useFinanceiro";
import { formatCurrency, formatCurrencyCompact, formatDateBR } from "../../../features/financeiro/utils/format";
import { StatusBadge } from "../../../features/financeiro/components/badges";
import {
  ArrowDownToLine,
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  Percent,
  TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const Stat = ({ icon: Icon, label, value, hint, accent = "slate", testId }) => {
  const accentMap = {
    slate: "text-slate-500",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
    violet: "text-violet-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${accentMap[accent]}`} />
      </div>
      <div className="text-2xl font-semibold text-slate-900 mt-2 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
};

export default function VisaoGeralPage() {
  const { data, loading } = useVisaoGeral();

  if (loading || !data) {
    return <div className="text-slate-500">Carregando visão geral…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={CircleDollarSign}
          label="A receber"
          value={formatCurrency(data.totalReceber)}
          hint={`${data.qtdParcelas} parcelas no total`}
          testId="stat-a-receber"
        />
        <Stat
          icon={ArrowDownToLine}
          label="Recebido no mês"
          value={formatCurrency(data.totalRecebidoMes)}
          hint="Baseado nos recebimentos deste mês"
          accent="emerald"
          testId="stat-recebido-mes"
        />
        <Stat
          icon={AlertTriangle}
          label="Em atraso"
          value={formatCurrency(data.totalAtrasado)}
          hint={`${data.qtdAtrasadas} parcelas atrasadas`}
          accent="rose"
          testId="stat-atrasado"
        />
        <Stat
          icon={Percent}
          label="Comissões liberadas"
          value={formatCurrency(data.comissoesLiberadas)}
          hint="Vinculadas a parcelas recebidas"
          accent="violet"
          testId="stat-comissoes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recebido vs previsto</h3>
              <p className="text-xs text-slate-500">Últimos 6 meses</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.serie} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} width={70} />
                <Tooltip formatter={(v) => formatCurrency(v)} labelStyle={{ color: "#0f172a" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="previsto" name="Previsto" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="recebido" name="Recebido" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Próximos vencimentos</h3>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-2">
            {data.proximas.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 border-slate-100">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{p.clienteNome}</div>
                  <div className="text-[11px] text-slate-500">
                    {formatDateBR(p.vencimento)} · Parcela {p.numero}/{p.totalParcelas}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-sm font-semibold tabular-nums">{formatCurrency(p.valor)}</div>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
