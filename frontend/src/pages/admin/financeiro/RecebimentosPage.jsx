// Página: Recebimentos
import React, { useMemo, useState } from "react";
import { useRecebimentos } from "../../../features/financeiro/hooks/useFinanceiro";
import { formatCurrency, formatDateBR } from "../../../features/financeiro/utils/format";
import { FormaPagamentoBadge, OrigemBadge } from "../../../features/financeiro/components/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowDownToLine } from "lucide-react";

export default function RecebimentosPage() {
  const { data, loading } = useRecebimentos();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => (data || []).filter((r) => !q || r.clienteNome.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const total = filtered.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="text-sm text-slate-600 inline-flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
          Total: <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Carregando…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhum recebimento.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm tabular-nums">{formatDateBR(r.data)}</TableCell>
                <TableCell className="font-medium text-slate-900">{r.clienteNome}</TableCell>
                <TableCell className="text-sm text-slate-600">{r.descricao}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-700 font-medium">{formatCurrency(r.valor)}</TableCell>
                <TableCell><FormaPagamentoBadge forma={r.formaPagamento} /></TableCell>
                <TableCell><OrigemBadge origem={r.origem} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
