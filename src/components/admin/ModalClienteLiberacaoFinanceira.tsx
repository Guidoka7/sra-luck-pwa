"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, Phone, UserRound, WalletCards, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatarMoeda } from "@/lib/utils";

interface ClienteBase {
  clienteId: string;
  nome: string;
  dataTermos: string | null;
  previsaoAtual: string | null;
  valor: number;
  statusFinanceiro: string | null;
  saldoRestante: number | null;
}

interface ClienteDetalhe {
  id: string;
  nome_completo: string;
  telefone: string | null;
  valor_contrato: number;
  status_financeiro: string | null;
  financeiro_saldo_restante: number | null;
}

function curta(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[0.55rem] font-bold text-success" : "inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-[0.55rem] font-bold text-burgundy"}>
      <CheckCircle2 className="h-3 w-3" />
      {children}
    </span>
  );
}

export function ModalClienteLiberacaoFinanceira({ cliente, onClose }: { cliente: ClienteBase | null; onClose: () => void }) {
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!cliente) return;
    let ativo = true;
    setDetalhe(null);
    setCarregando(true);
    fetch(`/api/admin/clientes/${cliente.clienteId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.erro ?? "Não foi possível carregar os dados da cliente.");
        if (ativo) setDetalhe(json.cliente ?? null);
      })
      .catch(() => {
        if (ativo) setDetalhe(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, [cliente]);

  if (!cliente) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const termosAssinados = Boolean(cliente.dataTermos && cliente.dataTermos <= hoje);
  const saldo = detalhe?.financeiro_saldo_restante ?? cliente.saldoRestante;
  const restantePago = detalhe?.status_financeiro === "pago" || (saldo !== null && saldo <= 0);
  const nome = detalhe?.nome_completo ?? cliente.nome;
  const telefone = detalhe?.telefone ?? null;
  const carta = Number(detalhe?.valor_contrato ?? cliente.valor);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <Card className="w-full max-w-sm overflow-hidden p-0 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-rose/10 bg-gradient-to-r from-blush/35 to-transparent px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-burgundy"><UserRound className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-burgundy">{nome}</p>
              <p className="text-[0.52rem] font-bold uppercase tracking-[0.16em] text-clay/40">Liberação financeira</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-clay/35 hover:bg-blush hover:text-burgundy" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-2.5 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-2))] p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-clay/40"><WalletCards className="h-3 w-3" /><span className="text-[0.5rem] font-bold uppercase tracking-label">Carta de crédito</span></div>
              <strong className="text-xs text-burgundy">{formatarMoeda(carta)}</strong>
            </div>
            <div className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-2))] p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-clay/40"><Phone className="h-3 w-3" /><span className="text-[0.5rem] font-bold uppercase tracking-label">Telefone</span></div>
              <strong className="truncate text-xs text-burgundy">{telefone || "Não informado"}</strong>
            </div>
          </div>

          <div className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-2))] p-2.5">
            <div className="mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-rose" /><span className="text-[0.52rem] font-bold uppercase tracking-label text-rose">Etapas</span></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between gap-2 rounded-md bg-[rgb(var(--surface-1))] px-2 py-1.5"><span className="text-[0.58rem] text-clay/55">Termos</span><Status ok={termosAssinados}>{termosAssinados ? "Assinado" : `Agendado ${curta(cliente.dataTermos)}`}</Status></div>
              <div className="flex items-center justify-between gap-2 rounded-md bg-[rgb(var(--surface-1))] px-2 py-1.5"><span className="text-[0.58rem] text-clay/55">Restante</span><Status ok={restantePago}>{restantePago ? "Pago" : "Pendente"}</Status></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[0.58rem]">
            <div className="rounded-lg bg-gold/6 px-2.5 py-2"><span className="text-clay/45">Liberação</span><p className="mt-0.5 font-bold text-burgundy">{curta(cliente.previsaoAtual)}</p></div>
            <div className="rounded-lg bg-gold/6 px-2.5 py-2"><span className="text-clay/45">Saldo restante</span><p className="mt-0.5 font-bold text-burgundy">{saldo !== null ? formatarMoeda(saldo) : "—"}</p></div>
          </div>

          {carregando && <div className="flex items-center justify-center gap-2 py-1 text-[0.55rem] text-clay/40"><Loader2 className="h-3 w-3 animate-spin" /> Atualizando dados...</div>}
        </div>
      </Card>
    </div>
  );
}
