// ApiAdapter — contrato do backend futuro.
// A implementação real preservará exatamente esta interface para que a UI,
// services e hooks não precisem ser reconstruídos quando o backend entrar.

import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const NOT_IMPLEMENTED = () => { throw new Error("ApiAdapter ainda não implementado. Backend do Financeiro pendente."); };

const ApiAdapter = {
  subscribe: () => () => {},
  listParcelas: () => axios.get(`${API}/financeiro/parcelas`).then((r) => r.data),
  getParcela: (id) => axios.get(`${API}/financeiro/parcelas/${id}`).then((r) => r.data),
  registrarRecebimento: (id, payload) => axios.post(`${API}/financeiro/parcelas/${id}/recebimento`, payload).then((r) => r.data),
  atualizarParcela: (id, patch) => axios.patch(`${API}/financeiro/parcelas/${id}`, patch).then((r) => r.data),
  negociarParcela: (id, payload) => axios.post(`${API}/financeiro/parcelas/${id}/negociar`, payload).then((r) => r.data),
  cancelarParcela: (id, motivo) => axios.post(`${API}/financeiro/parcelas/${id}/cancelar`, { motivo }).then((r) => r.data),
  anexarComprovante: (id, payload) => axios.post(`${API}/financeiro/parcelas/${id}/comprovantes`, payload).then((r) => r.data),
  listClientes: () => axios.get(`${API}/financeiro/clientes`).then((r) => r.data),
  getCliente: (id) => axios.get(`${API}/financeiro/clientes/${id}`).then((r) => r.data),
  getParcelasByCliente: (id) => axios.get(`${API}/financeiro/clientes/${id}/parcelas`).then((r) => r.data),
  criarCliente: (payload) => axios.post(`${API}/financeiro/clientes`, payload).then((r) => r.data),
  listRecebimentos: () => axios.get(`${API}/financeiro/recebimentos`).then((r) => r.data),
  listComissoes: () => axios.get(`${API}/financeiro/comissoes`).then((r) => r.data),
  getComissoesByParcela: (id) => axios.get(`${API}/financeiro/parcelas/${id}/comissoes`).then((r) => r.data),
  listIntegracoes: () => axios.get(`${API}/financeiro/integracoes`).then((r) => r.data),
  getSincronizacao: () => axios.get(`${API}/financeiro/sincronizacao`).then((r) => r.data),
  listHistorico: () => axios.get(`${API}/financeiro/historico`).then((r) => r.data),
  _notImplemented: NOT_IMPLEMENTED,
};

export default ApiAdapter;
