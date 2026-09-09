// Fachada de serviços do módulo Financeiro.
// Componentes/hooks consomem *apenas* estes services — nunca acessam adapters diretamente.
// O adapter atual é de protótipo; a futura API real entra sem alterar esta camada de UI.

import dataSource from "../adapters";
import { STATUS_PARCELA } from "../types";
import { isOverdue } from "../utils/format";

export const contasReceberService = {
  list: () => dataSource.listParcelas(),
  get: (id) => dataSource.getParcela(id),
  registrarRecebimento: (id, payload) => dataSource.registrarRecebimento(id, payload),
  atualizar: (id, patch) => dataSource.atualizarParcela(id, patch),
  negociar: (id, payload) => dataSource.negociarParcela(id, payload),
  cancelar: (id, motivo) => dataSource.cancelarParcela(id, motivo),
  anexarComprovante: (id, payload) => dataSource.anexarComprovante(id, payload),
};

export const clientesService = {
  list: () => dataSource.listClientes(),
  get: (id) => dataSource.getCliente(id),
  parcelasByCliente: (id) => dataSource.getParcelasByCliente(id),
  criar: (payload) => dataSource.criarCliente(payload),

  async resumo(clienteId) {
    const [cliente, parcelas] = await Promise.all([
      dataSource.getCliente(clienteId),
      dataSource.getParcelasByCliente(clienteId),
    ]);
    if (!cliente) return null;
    const totalContratado = parcelas.reduce((s, p) => s + p.valor, 0);
    const totalRecebido = parcelas
      .filter((p) => p.status === STATUS_PARCELA.recebido)
      .reduce((s, p) => s + (p.valorRecebido ?? p.valor), 0);
    const saldoPendente = parcelas
      .filter((p) => p.status !== STATUS_PARCELA.recebido && p.status !== STATUS_PARCELA.cancelado)
      .reduce((s, p) => s + p.valor, 0);
    const pagas = parcelas.filter((p) => p.status === STATUS_PARCELA.recebido).length;
    const atrasadas = parcelas.filter((p) => isOverdue(p) || p.status === STATUS_PARCELA.atrasado).length;
    const pendentes = parcelas.filter(
      (p) => p.status === STATUS_PARCELA.pendente || p.status === STATUS_PARCELA.aguardando,
    ).length;
    const ultimoPagamento = parcelas
      .filter((p) => p.recebidoEm)
      .sort((a, b) => new Date(b.recebidoEm) - new Date(a.recebidoEm))[0]?.recebidoEm ?? null;
    const proximoVencimento = parcelas
      .filter((p) => p.status !== STATUS_PARCELA.recebido && p.status !== STATUS_PARCELA.cancelado)
      .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0]?.vencimento ?? null;

    let situacao = "em_dia";
    if (atrasadas > 0) situacao = "inadimplente";
    else if (pendentes > 0) situacao = "com_pendencias";
    if (parcelas.length > 0 && pagas === parcelas.length) situacao = "quitado";

    return {
      cliente,
      parcelas,
      totalContratado,
      totalRecebido,
      saldoPendente,
      pagas,
      pendentes,
      atrasadas,
      totalParcelas: parcelas.length,
      ultimoPagamento,
      proximoVencimento,
      situacao,
    };
  },
};

export const recebimentosService = {
  list: () => dataSource.listRecebimentos(),
};

export const comissoesService = {
  list: () => dataSource.listComissoes(),
  byParcela: (parcelaId) => dataSource.getComissoesByParcela(parcelaId),
};

export const integracoesService = {
  list: () => dataSource.listIntegracoes(),
  sincronizacao: () => dataSource.getSincronizacao(),
};

export const historicoService = {
  list: () => dataSource.listHistorico(),
};

export const visaoGeralService = {
  async carregar() {
    const [parcelas, recebimentos, comissoes] = await Promise.all([
      dataSource.listParcelas(),
      dataSource.listRecebimentos(),
      dataSource.listComissoes(),
    ]);
    const totalReceber = parcelas
      .filter((p) => p.status !== STATUS_PARCELA.recebido && p.status !== STATUS_PARCELA.cancelado)
      .reduce((s, p) => s + p.valor, 0);
    const totalRecebidoMes = (() => {
      const now = new Date();
      return recebimentos
        .filter((r) => {
          if (!r.data) return false;
          const d = new Date(r.data);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s, r) => s + r.valor, 0);
    })();
    const atrasadas = parcelas.filter((p) => isOverdue(p) || p.status === STATUS_PARCELA.atrasado);
    const totalAtrasado = atrasadas.reduce((s, p) => s + p.valor, 0);
    const pendentesHoje = parcelas.filter((p) => {
      if (p.status === STATUS_PARCELA.recebido || p.status === STATUS_PARCELA.cancelado) return false;
      const v = new Date(p.vencimento);
      const t = new Date();
      return v.toDateString() === t.toDateString();
    });
    const proximas = parcelas
      .filter((p) => p.status !== STATUS_PARCELA.recebido && p.status !== STATUS_PARCELA.cancelado)
      .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))
      .slice(0, 6);

    const serie = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = ref.toLocaleDateString("pt-BR", { month: "short" });
      const recebidoMes = recebimentos
        .filter((r) => r.data && new Date(r.data).getMonth() === ref.getMonth() && new Date(r.data).getFullYear() === ref.getFullYear())
        .reduce((s, r) => s + r.valor, 0);
      const previstoMes = parcelas
        .filter((p) => new Date(p.vencimento).getMonth() === ref.getMonth() && new Date(p.vencimento).getFullYear() === ref.getFullYear())
        .reduce((s, p) => s + p.valor, 0);
      serie.push({ mes: label, recebido: recebidoMes, previsto: previstoMes });
    }

    const comissoesLiberadas = comissoes
      .filter((c) => c.status === "liberada" || c.status === "paga")
      .reduce((s, c) => s + c.valor, 0);

    return {
      totalReceber,
      totalRecebidoMes,
      totalAtrasado,
      qtdAtrasadas: atrasadas.length,
      qtdPendentesHoje: pendentesHoje.length,
      proximas,
      serie,
      comissoesLiberadas,
      qtdParcelas: parcelas.length,
    };
  },
};
