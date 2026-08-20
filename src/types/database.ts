export type StatusData = "disponivel" | "bloqueado";
export type StatusAgendamento = "confirmado" | "cancelado";
export type StatusCirurgia = "nao_agendada" | "agendada" | "realizada" | "cancelada";
export type StatusFinanceiro = "pago" | "a_pagar" | "parcial";
export type StatusBoleto = "nao_pago" | "pago" | "pendente_confirmacao" | "rejeitado";
export type QuantidadeParcelas = 12 | 18 | 24 | 36 | 48 | 60 | 72;
export type StatusRevisaoFinanceira = "pendente" | "aprovada" | "recusada";

export const STATUS_REVISAO_FINANCEIRA_LABEL: Record<StatusRevisaoFinanceira, string> = {
  pendente: "Revisão em andamento",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

// Prazo prometido pra cliente entre atingir o % necessário e o admin
// concluir o levantamento financeiro (confirmar ou recusar).
export const PRAZO_REVISAO_FINANCEIRA_HORAS = 72;

export const STATUS_BOLETO_LABEL: Record<StatusBoleto, string> = {
  nao_pago: "Não pago",
  pago: "Pago",
  pendente_confirmacao: "Aguardando confirmação",
  rejeitado: "Rejeitado",
};

export const QUANTIDADE_PARCELAS_OPCOES: QuantidadeParcelas[] = [12, 18, 24, 36, 48, 60, 72];

// % mínima de parcelas pagas pra liberar a agenda cirúrgica, por plano.
// Mantido em sync com a função pode_agendar() no banco (migration_003 + migration_004).
export const PERCENTUAL_MINIMO_AGENDAR: Record<QuantidadeParcelas, number> = {
  12: 60,
  18: 60,
  24: 60,
  36: 70,
  48: 80,
  60: 80,
  72: 80,
};

// Taxa administrativa PADRÃO sugerida por nº de parcelas (é o lucro da
// empresa como facilitadora de crédito). Pode ser editada por cliente no
// momento de gerar os boletos — isso aqui é só o valor sugerido inicial.
// Mantido em sync com a tabela comercial vigente.
export const TAXA_ADMINISTRATIVA_PADRAO: Record<QuantidadeParcelas, number> = {
  12: 25,
  18: 32,
  24: 41,
  36: 59,
  48: 63,
  60: 77,
  72: 83,
};

export const STATUS_CIRURGIA_LABEL: Record<StatusCirurgia, string> = {
  nao_agendada: "Não iniciado",
  agendada: "Agendado",
  realizada: "Concluído",
  cancelada: "Cancelado",
};

export const STATUS_FINANCEIRO_LABEL: Record<StatusFinanceiro, string> = {
  pago: "Pago",
  a_pagar: "A pagar",
  parcial: "Parcialmente pago",
};

export interface Configuracoes {
  id: 1;
  nome_clinica: string;
  meta_orcamento_mensal: number;
  frase_sonho: string;
  pix_chave: string;
  pix_qrcode_base64: string;
  whatsapp_contato: string;
  telefone_contato: string;
  // Quando true, o calendário de "Previsão de liberação financeira" mostra
  // só as datas disponíveis (verde); as demais aparecem como "Lotada".
  agenda_liberacao_financeira_bloqueada: boolean;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string; // YYYY-MM-DD
  telefone: string | null;
  email: string | null;
  procedimento: string | null;
  medico: string | null;
  hospital: string | null;
  consultora: string | null;
  valor_contrato: number; // valor LIBERADO à cliente (crédito facilitado, não é receita da empresa)
  taxa_administrativa_percentual: number; // % de lucro da empresa sobre o valor liberado, conforme nº de parcelas
  custo_total: number; // valor_contrato + taxa administrativa = o que é efetivamente parcelado em boletos
  status_cirurgia: StatusCirurgia;
  status_financeiro: StatusFinanceiro; // status manual, usado só como fallback antes de gerar boletos
  quantidade_parcelas: QuantidadeParcelas | null;
  ativo: boolean;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
  // Calculado pela API a partir dos boletos (parcelas pagas / total). null = boletos ainda não gerados.
  porcentagem_pagamento?: number | null;
  // Contagem de parcelas pagas / total de boletos gerados. null = boletos ainda não gerados.
  parcelas_pagas?: number | null;
  parcelas_total?: number | null;
  // Revisão financeira manual: null = ainda não atingiu o % necessário.
  // "pendente" = atingiu o %, aguardando o admin confirmar ou recusar.
  status_revisao_financeira?: StatusRevisaoFinanceira | null;
  data_atingiu_percentual?: string | null;
  observacao_revisao_financeira?: string | null;
}

export interface Boleto {
  id: string;
  cliente_id: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string | null;
  status: StatusBoleto;
  comprovante_url: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // presente apenas quando a API faz join com clientes (telas de admin)
  clientes?: { id: string; nome_completo: string; cpf: string };
}

export interface DataAgenda {
  id: string;
  data: string; // YYYY-MM-DD
  vagas_totais: number;
  status: StatusData;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
}

// Cliente agendada numa data, conforme retornado pela API de datas (join
// com agendamentos + clientes). statusRevisaoFinanceira reflete o mesmo
// campo status_revisao_financeira da cliente: null = ainda não atingiu o %
// necessário, "pendente" = aguardando confirmação do admin, "aprovada" =
// financeiro confirmado, "recusada" = divergência encontrada.
export interface ClienteAgendadaNaData {
  clienteId: string | null;
  nome: string;
  valor: number;
  criadoEm: string;
  statusRevisaoFinanceira: StatusRevisaoFinanceira | null;
}

// Calendário independente do de "Termos cirúrgicos": define quais datas
// estão disponíveis para agendar a PREVISÃO DE LIBERAÇÃO FINANCEIRA
// (pagamento) de uma cliente que já assinou os termos. Não tem "vagas" —
// cada data comporta uma liberação por vez (fica ocupada assim que uma
// previsão é confirmada nela).
export interface DataLiberacaoFinanceira {
  id: string;
  data: string; // YYYY-MM-DD
  status: StatusData;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agendamento {
  id: string;
  cliente_id: string;
  data_id: string;
  valor_contrato: number;
  status: StatusAgendamento;
  observacoes_internas: string | null;
  // Data em que a empresa fará o pagamento (liberação do crédito) da
  // cirurgia dessa cliente — informada a ela no ato da assinatura dos
  // termos cirúrgicos.
  previsao_liberacao_financeira: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogAlteracao {
  id: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}
