// Adapter Mock — implementa a interface do FinanceiroDataSource
// usando dados locais. Deve ser trocável por ApiAdapter sem alterar componentes.

import { MOCK } from "../data/mockData";
import { STATUS_PARCELA, HISTORICO_TIPOS } from "../types";
import { isOverdue } from "../utils/format";

// Estado local mutável (permite baixas, edições em memória enquanto o backend não existe)
const state = {
  parcelas: MOCK.parcelas.map((p) => ({ ...p })),
  clientes: MOCK.clientes.map((c) => ({ ...c })),
  comissoes: MOCK.comissoes.map((c) => ({ ...c })),
  integracoes: MOCK.integracoes.map((i) => ({ ...i })),
  historico: MOCK.historico.map((h) => ({ ...h })),
  sincronizacao: { ...MOCK.sincronizacao },
};

// Recalcula status "atrasado" dinamicamente (para não engessar mocks)
const withDynamicStatus = (p) => {
  if (
    p.status === STATUS_PARCELA.pendente &&
    isOverdue({ ...p, status: STATUS_PARCELA.pendente })
  ) {
    return { ...p, status: STATUS_PARCELA.atrasado };
  }
  return p;
};

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const pushHistorico = (entry) => {
  state.historico.unshift({
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    data: new Date().toISOString(),
    ...entry,
  });
};

const MockAdapter = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // ---------- Parcelas / Contas a Receber ----------
  async listParcelas() {
    await delay();
    return state.parcelas.map(withDynamicStatus);
  },

  async getParcela(id) {
    await delay(60);
    const p = state.parcelas.find((x) => x.id === id);
    return p ? withDynamicStatus(p) : null;
  },

  async registrarRecebimento(id, payload) {
    await delay(180);
    const idx = state.parcelas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Parcela não encontrada");
    state.parcelas[idx] = {
      ...state.parcelas[idx],
      status: STATUS_PARCELA.recebido,
      valorRecebido: payload.valor ?? state.parcelas[idx].valor,
      recebidoEm: payload.data ?? new Date().toISOString(),
      formaPagamento: payload.formaPagamento ?? state.parcelas[idx].formaPagamento,
      origem: payload.origem ?? state.parcelas[idx].origem,
      observacoes: payload.observacoes ?? state.parcelas[idx].observacoes,
    };
    // Comissões vinculadas → liberadas
    state.comissoes = state.comissoes.map((c) =>
      c.parcelaId === id ? { ...c, status: "liberada", parcelaStatus: STATUS_PARCELA.recebido } : c,
    );
    pushHistorico({
      tipo: HISTORICO_TIPOS.recebimento,
      descricao: `Recebimento registrado — parcela ${state.parcelas[idx].numero}/${state.parcelas[idx].totalParcelas} de ${state.parcelas[idx].clienteNome}`,
      parcelaId: id,
      clienteId: state.parcelas[idx].clienteId,
    });
    notify();
    return state.parcelas[idx];
  },

  async atualizarParcela(id, patch) {
    await delay(140);
    const idx = state.parcelas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Parcela não encontrada");
    state.parcelas[idx] = { ...state.parcelas[idx], ...patch };
    pushHistorico({
      tipo: HISTORICO_TIPOS.parcela_alterada,
      descricao: `Parcela ${state.parcelas[idx].numero}/${state.parcelas[idx].totalParcelas} de ${state.parcelas[idx].clienteNome} atualizada`,
      parcelaId: id,
      clienteId: state.parcelas[idx].clienteId,
    });
    notify();
    return state.parcelas[idx];
  },

  async negociarParcela(id, { novoVencimento, observacoes }) {
    await delay(150);
    const idx = state.parcelas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Parcela não encontrada");
    state.parcelas[idx] = {
      ...state.parcelas[idx],
      vencimento: novoVencimento || state.parcelas[idx].vencimento,
      status: STATUS_PARCELA.negociado,
      observacoes: observacoes || state.parcelas[idx].observacoes,
    };
    pushHistorico({
      tipo: HISTORICO_TIPOS.negociacao,
      descricao: `Negociação registrada — parcela ${state.parcelas[idx].numero}/${state.parcelas[idx].totalParcelas} de ${state.parcelas[idx].clienteNome}`,
      parcelaId: id,
      clienteId: state.parcelas[idx].clienteId,
    });
    notify();
    return state.parcelas[idx];
  },

  async cancelarParcela(id, motivo) {
    await delay(120);
    const idx = state.parcelas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Parcela não encontrada");
    state.parcelas[idx] = {
      ...state.parcelas[idx],
      status: STATUS_PARCELA.cancelado,
      observacoes: motivo || state.parcelas[idx].observacoes,
    };
    state.comissoes = state.comissoes.map((c) =>
      c.parcelaId === id ? { ...c, status: "cancelada", parcelaStatus: STATUS_PARCELA.cancelado } : c,
    );
    pushHistorico({
      tipo: HISTORICO_TIPOS.cancelamento,
      descricao: `Parcela cancelada — ${state.parcelas[idx].clienteNome}${motivo ? " — " + motivo : ""}`,
      parcelaId: id,
      clienteId: state.parcelas[idx].clienteId,
    });
    notify();
    return state.parcelas[idx];
  },

  async anexarComprovante(id, { nome, origem }) {
    await delay(130);
    const idx = state.parcelas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Parcela não encontrada");
    const novo = {
      id: `cmp_${Date.now()}`,
      nome: nome || "comprovante.pdf",
      data: new Date().toISOString(),
      origem: origem || "manual",
      status: "aguardando_validacao",
    };
    state.parcelas[idx] = {
      ...state.parcelas[idx],
      comprovantes: [...(state.parcelas[idx].comprovantes || []), novo],
    };
    pushHistorico({
      tipo: HISTORICO_TIPOS.comprovante,
      descricao: `Comprovante anexado à parcela ${state.parcelas[idx].numero}/${state.parcelas[idx].totalParcelas} de ${state.parcelas[idx].clienteNome}`,
      parcelaId: id,
      clienteId: state.parcelas[idx].clienteId,
    });
    notify();
    return state.parcelas[idx];
  },

  // ---------- Clientes ----------
  async listClientes() {
    await delay();
    return state.clientes.map((c) => c);
  },

  async getCliente(id) {
    await delay(60);
    return state.clientes.find((c) => c.id === id) || null;
  },

  async getParcelasByCliente(clienteId) {
    await delay(80);
    return state.parcelas.filter((p) => p.clienteId === clienteId).map(withDynamicStatus);
  },

  // ---------- Recebimentos ----------
  async listRecebimentos() {
    await delay();
    return state.parcelas
      .filter((p) => p.status === STATUS_PARCELA.recebido)
      .map((p) => ({
        id: `rec_${p.id}`,
        parcelaId: p.id,
        clienteId: p.clienteId,
        clienteNome: p.clienteNome,
        descricao: p.descricao,
        valor: p.valorRecebido ?? p.valor,
        data: p.recebidoEm,
        formaPagamento: p.formaPagamento,
        origem: p.origem,
      }));
  },

  // ---------- Comissões ----------
  async listComissoes() {
    await delay();
    return state.comissoes.map((c) => c);
  },

  async getComissoesByParcela(parcelaId) {
    await delay(60);
    return state.comissoes.filter((c) => c.parcelaId === parcelaId);
  },

  // ---------- Integrações ----------
  async listIntegracoes() {
    await delay(80);
    return state.integracoes.map((i) => i);
  },

  async getSincronizacao() {
    await delay(60);
    return { ...state.sincronizacao };
  },

  // ---------- Histórico ----------
  async listHistorico() {
    await delay(80);
    return state.historico.map((h) => h);
  },
};

export default MockAdapter;
