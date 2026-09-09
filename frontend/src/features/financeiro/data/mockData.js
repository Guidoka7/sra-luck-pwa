// Fonte de dados MOCK temporária do protótipo frontend.
// Substituir pelo adapter/API real não deve exigir alteração nos componentes.

import { STATUS_PARCELA, FORMA_PAGAMENTO, ORIGEM, INTEGRACAO_STATUS, HISTORICO_TIPOS } from "../types";

let _seed = 1337;
const rand = () => { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const nomes = ["Maria Silva", "Ana Beatriz Souza", "Camila Oliveira", "Juliana Ferreira", "Fernanda Costa", "Patrícia Almeida", "Beatriz Lima", "Larissa Rodrigues", "Amanda Martins", "Carolina Gomes", "Priscila Barbosa", "Renata Cardoso", "Vanessa Ribeiro", "Tatiane Nunes", "Sabrina Pereira", "Isabela Araújo", "Bruna Carvalho", "Débora Mendes", "Aline Teixeira", "Michele Rocha"];
const contatos = ["11 98123-4567", "11 97654-3210", "21 99123-4567", "31 98765-4321", "41 99555-1122", "51 98333-2211", "61 97777-8899", "71 98111-2233"];
const descricoes = ["Contrato de assessoria pré-nupcial", "Consultoria de imagem — pacote completo", "Pacote 6 meses de mentoria", "Coaching executivo — trimestre", "Programa transformação pessoal", "Sessão premium de personal styling", "Assinatura anual VIP", "Consultoria de carreira"];
const paddedCPF = (n) => String(n).padStart(11, "0");

const CLIENTES = nomes.map((nome, i) => ({
  id: `cli_${i + 1}`,
  nome,
  cpf: paddedCPF(String(10000000000 + i * 3717293)),
  email: `${nome.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
  telefone: pick(contatos),
  contrato: `CT-${2025}-${String(i + 101).padStart(4, "0")}`,
  criadoEm: new Date(2024, randInt(0, 11), randInt(1, 28)).toISOString(),
}));

const buildParcelas = () => {
  const parcelas = [];
  const today = new Date();
  let counter = 1;
  CLIENTES.forEach((cliente) => {
    const totalParcelas = pick([3, 6, 12, 12, 6]);
    const valorParcela = pick([490, 690, 890, 1200, 1490, 1990, 2490]);
    const descricao = pick(descricoes);
    const parcelasGeradas = randInt(2, Math.min(6, totalParcelas));
    for (let n = 1; n <= parcelasGeradas; n++) {
      const vencOffset = randInt(-60, 90);
      const vencimento = new Date(today);
      vencimento.setDate(today.getDate() + vencOffset);
      const r = rand();
      let status;
      if (vencOffset < -5) status = r < 0.65 ? STATUS_PARCELA.recebido : r < 0.9 ? STATUS_PARCELA.atrasado : STATUS_PARCELA.negociado;
      else if (vencOffset < 0) status = r < 0.4 ? STATUS_PARCELA.atrasado : r < 0.7 ? STATUS_PARCELA.pendente : STATUS_PARCELA.aguardando;
      else status = r < 0.75 ? STATUS_PARCELA.pendente : r < 0.9 ? STATUS_PARCELA.aguardando : STATUS_PARCELA.cancelado;
      const forma = pick(Object.values(FORMA_PAGAMENTO));
      const origem = pick(Object.values(ORIGEM));
      const recebidoEm = status === STATUS_PARCELA.recebido ? new Date(vencimento.getTime() + randInt(-3, 5) * 86400000).toISOString() : null;
      parcelas.push({ id: `par_${counter++}`, clienteId: cliente.id, clienteNome: cliente.nome, clienteCpf: cliente.cpf, clienteContrato: cliente.contrato, clienteTelefone: cliente.telefone, descricao, numero: n, totalParcelas, valor: valorParcela, valorRecebido: status === STATUS_PARCELA.recebido ? valorParcela : null, vencimento: vencimento.toISOString(), status, formaPagamento: forma, origem, recebidoEm, observacoes: status === STATUS_PARCELA.negociado ? "Vencimento renegociado com a cliente." : "", comprovantes: status === STATUS_PARCELA.recebido && rand() > 0.5 ? [{ id: `cmp_${counter}`, nome: "comprovante.pdf", data: recebidoEm, origem, status: "validado" }] : [] });
    }
  });
  return parcelas;
};

const PARCELAS = buildParcelas();
const vendedoras = ["Marina Duarte", "Helena Prado", "Cecília Vasques", "Rafaela Nunes"];
const COMISSOES = PARCELAS.filter(() => rand() > 0.35).map((p, i) => ({ id: `com_${i + 1}`, parcelaId: p.id, clienteId: p.clienteId, clienteNome: p.clienteNome, vendedora: vendedoras[i % vendedoras.length], percentual: pick([5, 8, 10, 12]), valor: +(p.valor * pick([0.05, 0.08, 0.1, 0.12])).toFixed(2), status: p.status === STATUS_PARCELA.recebido ? pick(["liberada", "paga"]) : p.status === STATUS_PARCELA.cancelado ? "cancelada" : "aguardando_recebimento", parcelaStatus: p.status }));
const RECEBIMENTOS = PARCELAS.filter((p) => p.status === STATUS_PARCELA.recebido).map((p) => ({ id: `rec_${p.id}`, parcelaId: p.id, clienteId: p.clienteId, clienteNome: p.clienteNome, descricao: p.descricao, valor: p.valorRecebido ?? p.valor, data: p.recebidoEm, formaPagamento: p.formaPagamento, origem: p.origem }));

const INTEGRACOES = [
  { id: "conta_azul", nome: "Conta Azul", descricao: "Principal integração financeira futura do Sra. Luck.", status: INTEGRACAO_STATUS.em_preparacao, ultimaSincronizacao: null },
  { id: "mercado_pago", nome: "Mercado Pago / Cartão", descricao: "Checkout, cartão de crédito e webhooks de pagamento.", status: INTEGRACAO_STATUS.planejado, ultimaSincronizacao: null },
  { id: "cartao_credito", nome: "Cartão de crédito", descricao: "Camada de gateway para pagamentos com cartão, sem acoplamento ao provedor.", status: INTEGRACAO_STATUS.planejado, ultimaSincronizacao: null },
  { id: "banco", nome: "Banco / Boletos", descricao: "Webhooks, retornos bancários, conciliação e baixa automática.", status: INTEGRACAO_STATUS.planejado, ultimaSincronizacao: null },
];

const HISTORICO = [];
let hi = 1;
PARCELAS.slice(0, 40).forEach((p) => {
  HISTORICO.push({ id: `hist_${hi++}`, tipo: HISTORICO_TIPOS.parcela_criada, descricao: `Parcela ${p.numero}/${p.totalParcelas} criada para ${p.clienteNome}`, data: new Date(new Date(p.vencimento).getTime() - 40 * 86400000).toISOString(), parcelaId: p.id, clienteId: p.clienteId });
  if (p.status === STATUS_PARCELA.recebido) HISTORICO.push({ id: `hist_${hi++}`, tipo: HISTORICO_TIPOS.recebimento, descricao: `Recebimento confirmado da parcela ${p.numero}/${p.totalParcelas} de ${p.clienteNome}`, data: p.recebidoEm, parcelaId: p.id, clienteId: p.clienteId });
});
HISTORICO.push({ id: `hist_${hi++}`, tipo: HISTORICO_TIPOS.sincronizacao, descricao: "Sincronização preparada aguardando conexão com Conta Azul.", data: new Date().toISOString() });
HISTORICO.sort((a, b) => new Date(b.data) - new Date(a.data));

const SINCRONIZACAO = { ultima: null, clientesSincronizados: 0, parcelasSincronizadas: 0, recebimentosSincronizados: 0, pendencias: PARCELAS.length, erros: 0 };

export const MOCK = { clientes: CLIENTES, parcelas: PARCELAS, comissoes: COMISSOES, recebimentos: RECEBIMENTOS, integracoes: INTEGRACOES, historico: HISTORICO, sincronizacao: SINCRONIZACAO };
