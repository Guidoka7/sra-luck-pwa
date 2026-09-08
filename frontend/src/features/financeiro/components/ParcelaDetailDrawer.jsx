// Drawer de detalhamento da parcela — ações reais e visão completa.

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  CircleDollarSign,
  FileText,
  Paperclip,
  RefreshCw,
  XCircle,
  User,
  Phone,
  Receipt,
  History,
  Percent,
} from "lucide-react";
import { StatusBadge, FormaPagamentoBadge, OrigemBadge } from "./badges";
import { formatCurrency, formatCPF, formatDateBR, formatDateTimeBR, formatPhoneBR } from "../utils/format";
import {
  RegistrarRecebimentoDialog,
  NegociarDialog,
  CancelarDialog,
  AnexarComprovanteDialog,
} from "./dialogs";
import { useComissoesByParcela } from "../hooks/useFinanceiro";
import { STATUS_PARCELA } from "../types";

export default function ParcelaDetailDrawer({ parcela, open, onOpenChange }) {
  const [dlgReceb, setDlgReceb] = useState(false);
  const [dlgNeg, setDlgNeg] = useState(false);
  const [dlgCancel, setDlgCancel] = useState(false);
  const [dlgComp, setDlgComp] = useState(false);

  const { data: comissoes } = useComissoesByParcela(parcela?.id);
  const podeReceber = parcela && parcela.status !== STATUS_PARCELA.recebido && parcela.status !== STATUS_PARCELA.cancelado;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
          data-testid="parcela-drawer"
        >
          {parcela && (
            <>
              <SheetHeader className="p-6 pb-4 border-b bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <SheetDescription className="text-slate-500 text-xs mb-1">
                      Parcela {parcela.numero}/{parcela.totalParcelas} · {parcela.clienteContrato}
                    </SheetDescription>
                    <SheetTitle className="text-xl">{formatCurrency(parcela.valor)}</SheetTitle>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={parcela.status} />
                      <OrigemBadge origem={parcela.origem} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setDlgReceb(true)}
                    disabled={!podeReceber}
                    className="gap-2"
                    data-testid="btn-registrar-recebimento"
                  >
                    <ArrowDownToLine className="w-4 h-4" /> Registrar recebimento
                  </Button>
                  <Button variant="outline" onClick={() => setDlgNeg(true)} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Negociar
                  </Button>
                  <Button variant="outline" onClick={() => setDlgComp(true)} className="gap-2">
                    <Paperclip className="w-4 h-4" /> Anexar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDlgCancel(true)}
                    className="gap-2 text-rose-700 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </Button>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-6">
                <Tabs defaultValue="detalhes">
                  <TabsList>
                    <TabsTrigger value="detalhes" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Detalhes</TabsTrigger>
                    <TabsTrigger value="recebimento" className="gap-1.5"><CircleDollarSign className="w-3.5 h-3.5" />Recebimento</TabsTrigger>
                    <TabsTrigger value="comissoes" className="gap-1.5"><Percent className="w-3.5 h-3.5" />Comissões</TabsTrigger>
                    <TabsTrigger value="comprovantes" className="gap-1.5"><Paperclip className="w-3.5 h-3.5" />Comprovantes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="detalhes" className="pt-4 space-y-4">
                    <SectionCard title="Cliente" icon={User}>
                      <Info label="Nome" value={parcela.clienteNome} />
                      <Info label="CPF" value={formatCPF(parcela.clienteCpf)} />
                      <Info label="Contrato" value={parcela.clienteContrato} />
                      <Info label="Contato" value={<span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhoneBR(parcela.clienteTelefone)}</span>} />
                    </SectionCard>
                    <SectionCard title="Parcela" icon={Receipt}>
                      <Info label="Descrição" value={parcela.descricao} span={2} />
                      <Info label="Número" value={`${parcela.numero}/${parcela.totalParcelas}`} />
                      <Info label="Valor" value={formatCurrency(parcela.valor)} />
                      <Info label="Vencimento" value={formatDateBR(parcela.vencimento)} />
                      <Info label="Status" value={<StatusBadge status={parcela.status} />} />
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="recebimento" className="pt-4 space-y-4">
                    <SectionCard title="Recebimento" icon={CircleDollarSign}>
                      <Info label="Forma" value={<FormaPagamentoBadge forma={parcela.formaPagamento} />} />
                      <Info label="Origem" value={<OrigemBadge origem={parcela.origem} />} />
                      <Info label="Data" value={parcela.recebidoEm ? formatDateTimeBR(parcela.recebidoEm) : "—"} />
                      <Info label="Valor recebido" value={parcela.valorRecebido ? formatCurrency(parcela.valorRecebido) : "—"} />
                      {parcela.observacoes && <Info label="Observações" value={parcela.observacoes} span={2} />}
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="comissoes" className="pt-4 space-y-2">
                    {(comissoes || []).length === 0 && (
                      <p className="text-sm text-slate-500">Nenhuma comissão vinculada a esta parcela.</p>
                    )}
                    {(comissoes || []).map((c) => (
                      <div key={c.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{c.vendedora}</div>
                          <div className="text-xs text-slate-500">
                            {c.percentual}% sobre {formatCurrency(parcela.valor)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">{formatCurrency(c.valor)}</div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{c.status.replace(/_/g, " ")}</div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[11px] text-slate-400 pt-2">
                      ⚠️ A lógica real de comissões existente não é alterada nesta etapa. Esta visão apenas exibe o relacionamento.
                    </p>
                  </TabsContent>

                  <TabsContent value="comprovantes" className="pt-4 space-y-2">
                    {(parcela.comprovantes || []).length === 0 && (
                      <p className="text-sm text-slate-500">Nenhum comprovante anexado.</p>
                    )}
                    {(parcela.comprovantes || []).map((c) => (
                      <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium">{c.nome}</div>
                            <div className="text-[11px] text-slate-500">
                              {formatDateBR(c.data)} · {c.origem} · {c.status.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>

                <Separator />
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <History className="w-3 h-3" />
                  Ao registrar recebimento, o histórico e as comissões relacionadas são atualizados automaticamente.
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <RegistrarRecebimentoDialog parcela={parcela} open={dlgReceb} onOpenChange={setDlgReceb} />
      <NegociarDialog parcela={parcela} open={dlgNeg} onOpenChange={setDlgNeg} />
      <CancelarDialog parcela={parcela} open={dlgCancel} onOpenChange={setDlgCancel} />
      <AnexarComprovanteDialog parcela={parcela} open={dlgComp} onOpenChange={setDlgComp} />
    </>
  );
}

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      <span className="text-xs font-medium uppercase tracking-wider text-slate-600">{title}</span>
    </div>
    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
  </div>
);

const Info = ({ label, value, span = 1 }) => (
  <div className={span === 2 ? "col-span-2" : "col-span-1"}>
    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
    <div className="text-sm text-slate-900 font-medium">{value}</div>
  </div>
);
