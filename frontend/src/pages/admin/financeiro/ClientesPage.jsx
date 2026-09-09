// Página: Clientes financeiros
import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useClientes, useContasReceber } from "../../../features/financeiro/hooks/useFinanceiro";
import { formatCurrency, formatCPF, formatDateBR, isOverdue } from "../../../features/financeiro/utils/format";
import { STATUS_PARCELA } from "../../../features/financeiro/types";
import NovaClienteDialog from "../../../features/financeiro/components/NovaClienteDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpRight, Plus } from "lucide-react";

const situacaoBadge = (s) => {
  const map = {
    em_dia: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Em dia" },
    com_pendencias: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "Com pendências" },
    inadimplente: { className: "bg-rose-50 text-rose-700 border-rose-200", label: "Inadimplente" },
    quitado: { className: "bg-slate-100 text-slate-600 border-slate-200", label: "Quitado" },
  };
  const c = map[s] || map.em_dia;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
};

export default function ClientesPage() {
  const { data: clientes, loading: lc } = useClientes();
  const { data: parcelas, loading: lp } = useContasReceber();
  const [q, setQ] = useState("");
  const [novaClienteOpen, setNovaClienteOpen] = useState(false);

  const rows = useMemo(() => {
    if (!clientes || !parcelas) return [];
    return clientes.map((c) => {
      const ps = parcelas.filter((p) => p.clienteId === c.id);
      const totalContratado = ps.reduce((s, p) => s + p.valor, 0) || Number(c.valorContrato || 0);
      const totalRecebido = ps.filter((p) => p.status === STATUS_PARCELA.recebido).reduce((s, p) => s + (p.valorRecebido ?? p.valor), 0);
      const saldo = Math.max(totalContratado - totalRecebido, 0);
      const pagas = ps.filter((p) => p.status === STATUS_PARCELA.recebido).length;
      const pendentes = ps.filter((p) => p.status === STATUS_PARCELA.pendente || p.status === STATUS_PARCELA.aguardando).length;
      const atrasadas = ps.filter((p) => isOverdue(p) || p.status === STATUS_PARCELA.atrasado).length;
      const ultimoPagamento = ps.filter((p) => p.recebidoEm).sort((a, b) => new Date(b.recebidoEm) - new Date(a.recebidoEm))[0]?.recebidoEm ?? null;
      const proximoVencimento = ps.filter((p) => p.status !== STATUS_PARCELA.recebido && p.status !== STATUS_PARCELA.cancelado).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0]?.vencimento ?? null;
      let situacao = "em_dia";
      if (atrasadas > 0) situacao = "inadimplente";
      else if (pendentes > 0) situacao = "com_pendencias";
      if (ps.length > 0 && pagas === ps.length) situacao = "quitado";
      return { ...c, totalContratado, totalRecebido, saldo, pagas, pendentes, atrasadas, ultimoPagamento, proximoVencimento, situacao };
    });
  }, [clientes, parcelas]);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    return `${r.nome} ${r.cpf} ${r.contrato}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar cliente ou CPF" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="clientes-search" />
          </div>
          <Button className="gap-2" onClick={() => setNovaClienteOpen(true)} data-testid="btn-nova-cliente">
            <Plus className="w-4 h-4" /> Nova cliente
          </Button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Cliente</TableHead><TableHead className="text-right">Contratado</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-center">Pagas / Pend / Atr</TableHead><TableHead>Último pgto</TableHead><TableHead>Próx. venc.</TableHead><TableHead>Situação</TableHead><TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lc || lp) && <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Carregando…</TableCell></TableRow>}
            {!lc && !lp && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-10 text-slate-500">Nenhuma cliente encontrada.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id} className="hover:bg-slate-50/60">
                <TableCell><div className="font-medium text-slate-900">{r.nome}</div><div className="text-[11px] text-slate-500">{formatCPF(r.cpf)}{r.contrato ? ` · ${r.contrato}` : ""}</div></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.totalContratado)}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-700">{formatCurrency(r.totalRecebido)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(r.saldo)}</TableCell>
                <TableCell className="text-center text-sm"><span className="text-emerald-700">{r.pagas}</span> · <span className="text-amber-700">{r.pendentes}</span> · <span className="text-rose-700">{r.atrasadas}</span></TableCell>
                <TableCell className="text-sm tabular-nums">{r.ultimoPagamento ? formatDateBR(r.ultimoPagamento) : "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.proximoVencimento ? formatDateBR(r.proximoVencimento) : "—"}</TableCell>
                <TableCell>{situacaoBadge(r.situacao)}</TableCell>
                <TableCell><NavLink to={`/admin/financeiro/clientes/${r.id}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm" data-testid={`cliente-open-${r.id}`}><ArrowUpRight className="w-4 h-4" /></NavLink></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <NovaClienteDialog open={novaClienteOpen} onOpenChange={setNovaClienteOpen} />
    </div>
  );
}
