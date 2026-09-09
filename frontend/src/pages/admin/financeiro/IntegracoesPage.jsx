// Página: Integrações + Central de Sincronização
import React, { useState } from "react";
import { useIntegracoes, useSincronizacao } from "../../../features/financeiro/hooks/useFinanceiro";
import { IntegracaoStatusBadge } from "../../../features/financeiro/components/badges";
import { formatDateTimeBR } from "../../../features/financeiro/utils/format";
import IntegracaoConfigDialog from "../../../features/financeiro/components/IntegracaoConfigDialog";
import { Button } from "@/components/ui/button";
import { Plug, RefreshCw, Building2, CreditCard, Landmark, ShieldAlert, WalletCards } from "lucide-react";
import { toast } from "sonner";

const ICON = { conta_azul: Building2, mercado_pago: CreditCard, cartao_credito: WalletCards, banco: Landmark };

export default function IntegracoesPage() {
  const { data: integracoes, loading } = useIntegracoes();
  const { data: sinc } = useSincronizacao();
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading && <div className="text-slate-500">Carregando integrações…</div>}
        {(integracoes || []).map((i) => {
          const Icon = ICON[i.id] || Plug;
          return (
            <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-slate-100 grid place-items-center"><Icon className="w-5 h-5 text-slate-700" /></div>
                <IntegracaoStatusBadge status={i.status} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-3">{i.nome}</h3>
              <p className="text-sm text-slate-500 mt-1 min-h-[40px]">{i.descricao}</p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setSelected(i.id)} data-testid={`btn-integrar-${i.id}`}>
                Preparar conexão
              </Button>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Esta etapa é exclusivamente frontend. Nenhuma API externa é chamada e nenhuma credencial é armazenada. A camada de integração está sendo preparada para Conta Azul, Mercado Pago, cartões e bancos.
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Central de sincronização</h3>
            <p className="text-xs text-slate-500">Última sincronização: {sinc?.ultima ? formatDateTimeBR(sinc.ultima) : "nunca"}</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast.info("Sincronização preparada", { description: "A execução real será conectada ao backend em uma próxima etapa." })} data-testid="btn-sincronizar">
            <RefreshCw className="w-4 h-4" /> Sincronizar agora
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SyncStat label="Clientes sincronizados" value={sinc?.clientesSincronizados ?? 0} />
          <SyncStat label="Parcelas sincronizadas" value={sinc?.parcelasSincronizadas ?? 0} />
          <SyncStat label="Recebimentos sincronizados" value={sinc?.recebimentosSincronizados ?? 0} />
          <SyncStat label="Pendências" value={sinc?.pendencias ?? 0} accent="text-amber-700" />
          <SyncStat label="Erros" value={sinc?.erros ?? 0} accent="text-rose-700" />
        </div>
      </div>

      <IntegracaoConfigDialog integrationId={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

const SyncStat = ({ label, value, accent = "text-slate-900" }) => (
  <div className="border border-slate-200 rounded-lg p-3">
    <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xl font-semibold tabular-nums mt-1 ${accent}`}>{value}</div>
  </div>
);
