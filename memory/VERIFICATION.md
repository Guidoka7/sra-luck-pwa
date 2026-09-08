# Verificação independente — App de Colaboradores

**Status atual:** IMPLEMENTAÇÃO PARCIALMENTE VALIDADA — AGUARDANDO CONFIGURAÇÃO DO SUPABASE E APLICAÇÃO DA MIGRATION PARA TESTE AUTENTICADO COMPLETO.

**Relatório independente:** `test_reports/iteration_1.json`

## Funcionalidades validadas

1. Frontend público mobile em `/colaboradores/login`: título, e-mail, senha e ação de entrada renderizam corretamente.
2. Tratamento de indisponibilidade: sem Supabase, o formulário informa claramente que a autenticação corporativa não está configurada; nenhuma sessão é simulada.
3. Proteção pública sem sessão: `/colaboradores/vendedora`, `/colaboradores/sdr` e `/colaboradores/financeiro` redirecionam para o login único.
4. Ingresso público: a tela foi validada em `https://staff-hub-215.preview.emergentagent.com/colaboradores/login`.
5. Ausência de MOCK: nenhuma conta, autenticação, comissão ou dado fictício foi usado para aprovar critérios autenticados.
6. Verificação estática: `yarn tsc --noEmit` passou com a árvore gerada limpa e `yarn build` passou com todas as rotas novas.

## Funcionalidades bloqueadas

1. Login real no Supabase e identificação automática do perfil.
2. Acesso autenticado aos dashboards de Vendedora, SDR e Financeiro.
3. Isolamento real entre os três perfis e bloqueio cruzado de APIs.
4. Leitura ponta a ponta de clientes, vendas, agendamentos, comparecimentos, pagamentos e metas do Admin.
5. Geração de R$100 para Vendedora somente após confirmação da primeira parcela.
6. Prova transacional de que o reprocessamento não duplica a comissão da Vendedora.
7. Geração de R$10 para SDR somente após comparecimento confirmado e ausência sem comissão.
8. Histórico real e mudança de status das comissões.
9. Resumos reais das 18:00 em `America/Sao_Paulo`.

## Motivo exato dos bloqueios

- O processo do preview não possui as variáveis Supabase necessárias.
- Não há credenciais de contas TESTE para os três cargos.
- A migration que cria perfis, vínculos, eventos, comissões, metas e notificações ainda não foi aplicada no banco real.
- Sem essas dependências, aprovar qualquer fluxo autenticado exigiria MOCK, expressamente proibido.
- O supervisor do ambiente ainda aponta para o esqueleto FastAPI/Vite e está marcado como somente leitura; o app Next.js precisou ser servido diretamente na porta 3000 durante a verificação.

## Migration necessária

Aplicar integralmente, em ambiente de homologação antes de produção:

`supabase/migration_029_colaboradores_comissoes.sql`

Ela cria/altera:

- `colaboradores`
- `metas_colaboradores`
- `comissoes`
- `notificacoes_colaboradores`
- `mensagens_motivacionais`
- vínculos `clientes.vendedora_id`, `novas_vendas.vendedora_id` e `agendamentos.sdr_id`
- campos de comparecimento em `agendamentos`
- funções idempotentes de comissão da Vendedora e da SDR
- índices, RLS e publicação Realtime necessários

## Configurações necessárias

Configurar por canal seguro, sem commitar em Git:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLIENTE_SESSION_SECRET`
- `NOTIFICACOES_CRON_SECRET`
- `NOTIFICACOES_APP_URL=https://staff-hub-215.preview.emergentagent.com`

As três primeiras vêm do projeto Supabase já utilizado pelo ecossistema. Os dois segredos devem ser valores fortes gerados para o ambiente. Não expor `SUPABASE_SERVICE_ROLE_KEY` ao navegador.

## Procedimento para desbloquear

1. Configurar as variáveis acima no ambiente do app Next.js.
2. Corrigir o processo do preview para executar `yarn dev` em `/app`, porta 3000.
3. Aplicar `migration_029_colaboradores_comissoes.sql` no Supabase de homologação.
4. Criar ou selecionar três usuários Supabase Auth claramente identificados como TESTE.
5. Vincular esses usuários aos cargos Vendedora, SDR e Financeiro pelo Admin.
6. Vincular cliente/venda à Vendedora e agendamento à SDR pela área “Vínculos da Equipe”.
7. Executar nova verificação independente completa, sem MOCK, cobrindo autenticação, roteamento, isolamento, dados do Admin e as duas regras de comissão.

## Resultado do agente de testes

- Aprovados: 3 checks executados de frontend/ingresso/proteção pública.
- Falhas: 0.
- Bloqueados: todos os critérios autenticados e transacionais descritos acima.
- Reteste necessário: sim, obrigatoriamente após configuração do Supabase e aplicação da migration.