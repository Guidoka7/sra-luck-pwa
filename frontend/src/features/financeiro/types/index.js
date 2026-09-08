// Tipos e enums do módulo Financeiro (JSDoc)
// Servem como contrato de dados entre adapters e componentes.

export const STATUS_PARCELA = {
  pendente: "pendente",
  recebido: "recebido",
  atrasado: "atrasado",
  aguardando: "aguardando", // aguardando confirmação
  negociado: "negociado",
  cancelado: "cancelado",
};

export const STATUS_LABEL = {
  pendente: "Pendente",
  recebido: "Recebido",
  atrasado: "Em atraso",
  aguardando: "Aguardando confirmação",
  negociado: "Negociado",
  cancelado: "Cancelado",
};

export const FORMA_PAGAMENTO = {
  boleto: "boleto",
  pix: "pix",
  cartao_credito: "cartao_credito",
  comprovante_manual: "comprovante_manual",
  dinheiro: "dinheiro",
};

export const FORMA_LABEL = {
  boleto: "Boleto bancário",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  comprovante_manual: "Comprovante manual",
  dinheiro: "Dinheiro",
};

export const ORIGEM = {
  conta_azul: "conta_azul",
  mercado_pago: "mercado_pago",
  banco: "banco",
  manual: "manual",
};

export const ORIGEM_LABEL = {
  conta_azul: "Conta Azul",
  mercado_pago: "Mercado Pago",
  banco: "Banco / Boleto",
  manual: "Manual",
};

export const INTEGRACAO_STATUS = {
  em_preparacao: "em_preparacao",
  planejado: "planejado",
  nao_conectado: "nao_conectado",
  em_desenvolvimento: "em_desenvolvimento",
};

export const INTEGRACAO_STATUS_LABEL = {
  em_preparacao: "Em preparação",
  planejado: "Planejado",
  nao_conectado: "Não conectado",
  em_desenvolvimento: "Em desenvolvimento",
};

export const HISTORICO_TIPOS = {
  cliente_criado: "cliente_criado",
  parcela_criada: "parcela_criada",
  parcela_alterada: "parcela_alterada",
  recebimento: "recebimento",
  baixa: "baixa",
  cancelamento: "cancelamento",
  negociacao: "negociacao",
  integracao: "integracao",
  webhook: "webhook",
  sincronizacao: "sincronizacao",
  comprovante: "comprovante",
  comissao: "comissao",
};
