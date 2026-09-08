// Hooks React para o módulo Financeiro.
// Assinam mudanças no adapter (que hoje é o MockAdapter em memória)
// para refletir baixas/edições imediatamente em toda a UI.

import { useCallback, useEffect, useState } from "react";
import dataSource from "../adapters";
import {
  contasReceberService,
  clientesService,
  recebimentosService,
  comissoesService,
  integracoesService,
  historicoService,
  visaoGeralService,
} from "../services/financeiroService";

const useLive = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loader();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const unsub = dataSource.subscribe(load);
    return unsub;
  }, [load]);

  return { data, loading, error, refetch: load };
};

export const useContasReceber = () => useLive(() => contasReceberService.list(), []);
export const useParcela = (id) => useLive(() => contasReceberService.get(id), [id]);
export const useClientes = () => useLive(() => clientesService.list(), []);
export const useClienteResumo = (id) => useLive(() => clientesService.resumo(id), [id]);
export const useRecebimentos = () => useLive(() => recebimentosService.list(), []);
export const useComissoes = () => useLive(() => comissoesService.list(), []);
export const useComissoesByParcela = (parcelaId) =>
  useLive(() => (parcelaId ? comissoesService.byParcela(parcelaId) : Promise.resolve([])), [parcelaId]);
export const useIntegracoes = () => useLive(() => integracoesService.list(), []);
export const useSincronizacao = () => useLive(() => integracoesService.sincronizacao(), []);
export const useHistorico = () => useLive(() => historicoService.list(), []);
export const useVisaoGeral = () => useLive(() => visaoGeralService.carregar(), []);
