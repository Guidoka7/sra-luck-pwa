// Página: Contas a receber — tela principal do módulo.
import React, { useMemo, useState } from "react";
import { useContasReceber } from "../../../features/financeiro/hooks/useFinanceiro";
import {
  formatCurrency,
  formatDateBR,
  formatCPF,
} from "../../../features/financeiro/utils/format";
import { STATUS_PARCELA, STATUS_LABEL, FORMA_LABEL, ORIGEM_LABEL } from "../../../features/financeiro/types";
import { StatusBadge, FormaPagamentoBadge, OrigemBadge } from "../../../features/financeiro/components/badges";
import ParcelaDetailDrawer from "../../../features/financeiro/components/ParcelaDetailDrawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, Filter, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PERIODOS = {
  todos: "Todos os períodos",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  mes: "Este mês",
  atrasadas: "Em atraso",
};

export default function ContasReceberPage() {
  const { data, loading } = useContasReceber();
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [periodo, setPeriodo] = useState("todos");
  const [forma, setForma] = useState("todos");
  const [origem, setOrigem] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return data.filter((p) => {
      // busca
      if (q) {
        const query = q.toLowerCase();
        const hay = [
          p.clienteNome,
          p.clienteCpf,
          p.clienteContrato,
          `${p.numero}/${p.totalParcelas}`,
        ].join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (forma !== "todos" && p.formaPagamento !== forma) return false;
      if (origem !== "todos" && p.origem !== origem) return false;
      const venc = new Date(p.vencimento);
      if (periodo === "hoje" && venc.toDateString() !== now.toDateString()) return false;
      if (periodo === "semana") {
        const diff = (venc - now) / 86400000;
        if (diff < 0 || diff > 7) return false;
      }
      if (periodo === "mes" && (venc.getMonth() !== now.getMonth() || venc.getFullYear() !== now.getFullYear())) return false;
      if (periodo === "atrasadas" && p.status !== STATUS_PARCELA.atrasado) return false;
      return true;
    });
  }, [data, q, statusFiltro, periodo, forma, origem]);

  const totais = useMemo(() => {
    const total = filtered.reduce((s, p) => s + p.valor, 0);
    const recebido = filtered.filter((p) => p.status === STATUS_PARCELA.recebido).reduce((s, p) => s + (p.valorRecebido ?? p.valor), 0);
    const atrasado = filtered.filter((p) => p.status === STATUS_PARCELA.atrasado).reduce((s, p) => s + p.valor, 0);
    return { total, recebido, atrasado };
  }, [filtered]);

  const abrir = (p) => {
    setSelected(p);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, CPF, contrato ou parcela"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              data-testid="contas-receber-search"
            />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODOS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as formas</SelectItem>
              {Object.entries(FORMA_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              {Object.entries(ORIGEM_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" data-testid="btn-exportar">
            <Download className="w-4 h-4" /> Exportar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-6 text-xs text-slate-600">
          <span><span className="font-semibold text-slate-900 tabular-nums">{filtered.length}</span> parcelas exibidas</span>
          <span>Total: <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(totais.total)}</span></span>
          <span className="text-emerald-700">Recebido: <span className="font-semibold tabular-nums">{formatCurrency(totais.recebido)}</span></span>
          <span className="text-rose-700">Em atraso: <span className="font-semibold tabular-nums">{formatCurrency(totais.atrasado)}</span></span>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[220px]">Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center w-[80px]">Parcela</TableHead>
              <TableHead className="text-right w-[110px]">Valor</TableHead>
              <TableHead className="w-[110px]">Vencimento</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-[110px]">Recebido em</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-500">Carregando…</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-slate-500">
                <Filter className="w-4 h-4 inline mr-1" /> Nenhuma parcela encontrada com os filtros atuais.
              </TableCell></TableRow>
            )}
            {filtered.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer hover:bg-slate-50/60"
                onClick={() => abrir(p)}
                data-testid={`row-parcela-${p.id}`}
              >
                <TableCell>
                  <div className="font-medium text-slate-900">{p.clienteNome}</div>
                  <div className="text-[11px] text-slate-500">{formatCPF(p.clienteCpf)}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-700 line-clamp-1 max-w-[280px]">{p.descricao}</div>
                  <div className="text-[11px] text-slate-500">{p.clienteContrato}</div>
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{p.numero}/{p.totalParcelas}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.valor)}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatDateBR(p.vencimento)}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell><FormaPagamentoBadge forma={p.formaPagamento} /></TableCell>
                <TableCell><OrigemBadge origem={p.origem} /></TableCell>
                <TableCell className="text-sm tabular-nums">{p.recebidoEm ? formatDateBR(p.recebidoEm) : "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8" data-testid={`row-actions-${p.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => abrir(p)}>Ver detalhes</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => abrir(p)}>Registrar recebimento</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => abrir(p)}>Negociar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => abrir(p)}>Anexar comprovante</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ParcelaDetailDrawer parcela={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
