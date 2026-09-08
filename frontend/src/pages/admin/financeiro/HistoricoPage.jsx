// Página: Histórico financeiro
import React, { useState, useMemo } from "react";
import { useHistorico } from "../../../features/financeiro/hooks/useFinanceiro";
import { formatDateTimeBR } from "../../../features/financeiro/utils/format";
import { HISTORICO_TIPOS } from "../../../features/financeiro/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  UserPlus,
  Receipt,
  Edit,
  ArrowDownToLine,
  ClipboardCheck,
  XCircle,
  RefreshCw,
  Plug,
  Radio,
  RefreshCcw,
  Paperclip,
  Percent,
} from "lucide-react";

const TIPO_META = {
  [HISTORICO_TIPOS.cliente_criado]: { icon: UserPlus, label: "Cliente criado", color: "text-sky-600" },
  [HISTORICO_TIPOS.parcela_criada]: { icon: Receipt, label: "Parcela criada", color: "text-slate-600" },
  [HISTORICO_TIPOS.parcela_alterada]: { icon: Edit, label: "Parcela alterada", color: "text-amber-600" },
  [HISTORICO_TIPOS.recebimento]: { icon: ArrowDownToLine, label: "Recebimento", color: "text-emerald-600" },
  [HISTORICO_TIPOS.baixa]: { icon: ClipboardCheck, label: "Baixa", color: "text-emerald-600" },
  [HISTORICO_TIPOS.cancelamento]: { icon: XCircle, label: "Cancelamento", color: "text-rose-600" },
  [HISTORICO_TIPOS.negociacao]: { icon: RefreshCw, label: "Negociação", color: "text-violet-600" },
  [HISTORICO_TIPOS.integracao]: { icon: Plug, label: "Integração", color: "text-slate-600" },
  [HISTORICO_TIPOS.webhook]: { icon: Radio, label: "Webhook", color: "text-slate-600" },
  [HISTORICO_TIPOS.sincronizacao]: { icon: RefreshCcw, label: "Sincronização", color: "text-slate-600" },
  [HISTORICO_TIPOS.comprovante]: { icon: Paperclip, label: "Comprovante", color: "text-slate-600" },
  [HISTORICO_TIPOS.comissao]: { icon: Percent, label: "Comissão", color: "text-violet-600" },
};

export default function HistoricoPage() {
  const { data, loading } = useHistorico();
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => (data || []).filter((h) => !q || h.descricao.toLowerCase().includes(q.toLowerCase())),
    [data, q],
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar no histórico" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        {loading && <div className="p-6 text-slate-500">Carregando…</div>}
        {!loading && filtered.length === 0 && <div className="p-6 text-slate-500">Nenhum registro.</div>}
        <ul className="divide-y divide-slate-100">
          {filtered.map((h) => {
            const meta = TIPO_META[h.tipo] || { icon: Receipt, label: h.tipo, color: "text-slate-600" };
            const Icon = meta.icon;
            return (
              <li key={h.id} className="p-4 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center shrink-0 ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{meta.label}</Badge>
                    <span className="text-[11px] text-slate-500 tabular-nums">{formatDateTimeBR(h.data)}</span>
                  </div>
                  <div className="text-sm text-slate-800">{h.descricao}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
