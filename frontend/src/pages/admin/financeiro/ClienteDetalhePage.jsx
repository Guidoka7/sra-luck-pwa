// Perfil financeiro do cliente.
import React, { useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { useClienteResumo } from "../../../features/financeiro/hooks/useFinanceiro";
import {
  formatCurrency,
  formatCPF,
  formatDateBR,
  formatPhoneBR,
} from "../../../features/financeiro/utils/format";
import { StatusBadge, FormaPagamentoBadge, OrigemBadge } from "../../../features/financeiro/components/badges";
import ParcelaDetailDrawer from "../../../features/financeiro/components/ParcelaDetailDrawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Mail, Phone, FileText } from "lucide-react";

export default function ClienteDetalhePage() {
  const { id } = useParams();
  const { data, loading } = useClienteResumo(id);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading || !data) return <div className="text-slate-500">Carregando perfil financeiro…</div>;

  const { cliente, parcelas, totalContratado, totalRecebido, saldoPendente } = data;
  const recebimentos = parcelas.filter((p) => p.recebidoEm).sort((a, b) => new Date(b.recebidoEm) - new Date(a.recebidoEm));
  const comprovantes = parcelas.flatMap((p) => (p.comprovantes || []).map((c) => ({ ...c, parcelaNumero: `${p.numero}/${p.totalParcelas}` })));

  return (
    <div className="space-y-4">
      <NavLink to="/admin/financeiro/clientes" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-sm">
        <ChevronLeft className="w-4 h-4" /> Voltar para clientes
      </NavLink>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">{cliente.contrato}</div>
            <h2 className="text-2xl font-semibold text-slate-900">{cliente.nome}</h2>
            <div className="text-sm text-slate-500 mt-1">{formatCPF(cliente.cpf)}</div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{cliente.email}</span>
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{formatPhoneBR(cliente.telefone)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Contratado</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalContratado)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Recebido</div>
              <div className="text-lg font-semibold text-emerald-700 tabular-nums">{formatCurrency(totalRecebido)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Saldo aberto</div>
              <div className="text-lg font-semibold text-slate-900 tabular-nums">{formatCurrency(saldoPendente)}</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="parcelas">
        <TabsList>
          <TabsTrigger value="parcelas">Parcelas ({parcelas.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="comprovantes">Comprovantes</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="parcelas" className="pt-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[80px] text-center">#</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recebido em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-slate-50/60"
                    onClick={() => { setSelected(p); setDrawerOpen(true); }}
                  >
                    <TableCell className="text-center text-sm tabular-nums">{p.numero}/{p.totalParcelas}</TableCell>
                    <TableCell>{p.descricao}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.valor)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDateBR(p.vencimento)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-sm tabular-nums">{p.recebidoEm ? formatDateBR(p.recebidoEm) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            Histórico consolidado do cliente será exibido aqui quando o backend real do Sra. Luck fornecer eventos.
            Nesta etapa, o Histórico geral do módulo já registra todas as ações executadas.
          </div>
        </TabsContent>

        <TabsContent value="comprovantes" className="pt-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comprovantes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">Nenhum comprovante para este cliente.</TableCell></TableRow>}
                {comprovantes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><span className="inline-flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-slate-500" />{c.nome}</span></TableCell>
                    <TableCell className="text-sm tabular-nums">{c.parcelaNumero}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDateBR(c.data)}</TableCell>
                    <TableCell><OrigemBadge origem={c.origem} /></TableCell>
                    <TableCell className="text-sm text-slate-600">{c.status.replace(/_/g, " ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="pt-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Data</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recebimentos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">Sem recebimentos.</TableCell></TableRow>}
                {recebimentos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm tabular-nums">{formatDateBR(p.recebidoEm)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{p.numero}/{p.totalParcelas}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.valorRecebido ?? p.valor)}</TableCell>
                    <TableCell><FormaPagamentoBadge forma={p.formaPagamento} /></TableCell>
                    <TableCell><OrigemBadge origem={p.origem} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ParcelaDetailDrawer parcela={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
