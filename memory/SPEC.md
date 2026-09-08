# Sra. Luck — Módulo de Colaboradores

## Escopo

Extensão do mesmo app Next.js/Supabase existente. O login de colaboradores fica em `/colaboradores/login`; `/login` das clientes e `/admin/login` do painel administrativo permanecem intactos.

## Perfis e acesso

- `vendedora`: vê apenas clientes, vendas e comissões vinculadas ao seu `colaboradores.id`.
- `sdr`: vê apenas agendamentos vinculados ao seu `colaboradores.id` e suas comissões.
- `financeiro`: vê indicadores de pagamentos confirmados e metas permitidas; a fórmula de comissão permanece indefinida.
- Usuários do Admin sem perfil de colaborador continuam no painel administrativo. Usuários colaboradores ativos são redirecionados para seu próprio painel e bloqueados do Admin.

## Fonte de verdade

Supabase Auth continua autenticando usuários; Supabase/Postgres continua sendo a fonte única para clientes, vendas, agendamentos, boletos e pagamentos. `clientes.vendedora_id`, `novas_vendas.vendedora_id` e `agendamentos.sdr_id` são vínculos, não cópias.

## Comissões

- Vendedora: R$100 somente para o evento `primeira_parcela_confirmada` quando `boletos.numero_parcela = 1` e `status = pago`.
- SDR: R$10 somente para o evento `comparecimento` quando `agendamentos.comparecimento_status = compareceu`.
- A chave única `comissoes.chave_evento` e as funções SQL impedem duplicidade em reprocessamentos.
- Financeiro: sem fórmula inventada; metas e percentual podem ser configurados pelo Admin, mas comissão estimada/final permanece nula até definição oficial.

## Eventos e notificações

O Admin registra comparecimento por API autorizada. A rotina existente de notificações chama o resumo de colaboradores; o resumo diário é idempotente e só é gerado às 18:00 em `America/Sao_Paulo`.

## Pendências operacionais

1. Aplicar `supabase/migration_029_colaboradores_comissoes.sql` no projeto Supabase antes de cadastrar perfis.
2. Vincular usuários Supabase existentes aos perfis pelo painel Admin; nenhuma conta real é criada automaticamente.
3. A base atual não registra leads não convertidos, então o dashboard da vendedora sinaliza o comparativo como indisponível, sem inventar vermelho/verde.
4. Power BI permanece apenas preparado; não há integração ativa nem dados MOCKADOS.
5. O ambiente precisa fornecer `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENTE_SESSION_SECRET` e `NOTIFICACOES_CRON_SECRET`; sem elas, as APIs retornam indisponibilidade explícita e nenhum dado é inventado.