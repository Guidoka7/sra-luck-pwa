# PRD — Módulo Financeiro do Sra. Luck

## Contexto
O projeto Sra. Luck não estava presente neste workspace (apenas o template Emergent).
O módulo Financeiro foi implementado como um **frontend definitivo, auto-contido, isolado por camada de dados (Adapter Pattern)**, pronto para ser plugado no painel real do Sra. Luck e para receber, no futuro, backends próprios e integrações com Conta Azul, Mercado Pago e webhooks bancários.

## Personas
- **Admin financeiro do Sra. Luck** — gerencia contas a receber, registra baixas, negocia parcelas, anexa comprovantes.
- **Time comercial** — consulta clientes, saldos e comissões vinculadas.

## Core requirements (estáticos)
- Rota principal: `/admin/financeiro`
- 7 seções: Visão geral, Contas a receber, Clientes, Recebimentos, Comissões, Integrações, Histórico
- Real BR (R$) e datas dd/mm/aaaa
- Adapter Pattern com Mock ⇄ Api trocáveis sem tocar em componentes
- Reflete estado real: nenhuma integração externa fingindo estar conectada

## Implementado — 09/2026
- Shell administrativo mínimo (`/admin`) com sidebar + header
- Módulo Financeiro completo com sub-navegação
- Camada de dados: `features/financeiro/{types,data,adapters,services,hooks,components,utils}`
  - `MockAdapter` com 80 parcelas geradas para 20 clientes, múltiplos status/formas/origens
  - `ApiAdapter` stub com endpoints previstos (`/api/financeiro/**`)
  - Trocador em `adapters/index.js`
- Visão geral com stat cards + gráfico (Recharts) + próximos vencimentos
- Contas a receber: tabela profissional, busca, filtros (status, período, forma, origem), totais dinâmicos, drawer de detalhe, ações (registrar recebimento, negociar, cancelar, anexar comprovante)
- Clientes financeiros: lista com totais + perfil `/clientes/:id` (parcelas, pagamentos, comprovantes, histórico)
- Recebimentos: lista consolidada com totais
- Comissões: visão relacionada às parcelas (lógica original preservada)
- Integrações: cards Conta Azul (Em preparação), Mercado Pago (Planejado), Banco (Planejado) + Central de sincronização
- Histórico financeiro com timeline e busca

## Backlog priorizado
- **P0** — Backend financeiro real (endpoints implementados pelo `ApiAdapter`)
- **P0** — Integração Conta Azul (auth OAuth + sync bidirecional)
- **P1** — Integração Mercado Pago (cobrança cartão) via backend
- **P1** — Webhooks bancários para baixa automática
- **P1** — Upload real de comprovantes (object storage)
- **P2** — Envio de cobranças automáticas por e-mail/WhatsApp
- **P2** — Relatórios exportáveis (Excel/PDF)
- **P2** — Dashboard com metas e forecast

## Como plugar ao Sra. Luck real
1. Copiar `frontend/src/features/financeiro/` e `frontend/src/pages/admin/financeiro/` para o projeto real.
2. Registrar as rotas em `<Routes>` (ver `App.js`).
3. Substituir o import em `features/financeiro/adapters/index.js`:
   `import ApiAdapter from "./ApiAdapter"; export default ApiAdapter;`
4. Implementar os endpoints `/api/financeiro/**` no backend do Sra. Luck.
