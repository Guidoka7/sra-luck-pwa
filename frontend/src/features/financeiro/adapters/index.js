// Ponto de troca do data source do Financeiro.
// Hoje: MockAdapter. Amanhã: ApiAdapter (Sra. Luck / Conta Azul / Mercado Pago).
//
// Para trocar o adapter em produção, basta alterar a linha abaixo — nenhum
// componente, service ou hook precisa ser modificado.

import MockAdapter from "./MockAdapter";
// import ApiAdapter from "./ApiAdapter";

const dataSource = MockAdapter;

export default dataSource;
