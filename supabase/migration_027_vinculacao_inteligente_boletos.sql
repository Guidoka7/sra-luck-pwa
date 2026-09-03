-- ============================================================================
-- MIGRATION 027: Central de Vinculação Inteligente de Boletos
-- Somente estrutura de análise/vinculação. NÃO executar automaticamente.
-- ============================================================================

alter table importacoes_boletos add column if not exists cliente_sugerido_id uuid references clientes(id) on delete set null;
alter table importacoes_boletos add column if not exists carne_sugerido_id uuid references carnes(id) on delete set null;
alter table importacoes_boletos add column if not exists boleto_sugerido_id uuid references boletos(id) on delete set null;
alter table importacoes_boletos add column if not exists cliente_vinculado_id uuid references clientes(id) on delete set null;
alter table importacoes_boletos add column if not exists carne_vinculado_id uuid references carnes(id) on delete set null;
alter table importacoes_boletos add column if not exists boleto_vinculado_id uuid references boletos(id) on delete set null;
alter table importacoes_boletos add column if not exists pontuacao_confianca integer;
alter table importacoes_boletos add column if not exists nivel_confianca text;
alter table importacoes_boletos add column if not exists status_vinculacao text not null default 'pendente';
alter table importacoes_boletos add column if not exists analise_detalhada jsonb not null default '{}'::jsonb;

create index if not exists idx_importacoes_boletos_vinculacao_status on importacoes_boletos(status_vinculacao);
create index if not exists idx_importacoes_boletos_nivel_confianca on importacoes_boletos(nivel_confianca);
create index if not exists idx_importacoes_boletos_cliente_sugerido on importacoes_boletos(cliente_sugerido_id);
create index if not exists idx_importacoes_boletos_boleto_sugerido on importacoes_boletos(boleto_sugerido_id);

alter table importacoes_boletos drop constraint if exists importacoes_boletos_nivel_confianca_chk;
alter table importacoes_boletos add constraint importacoes_boletos_nivel_confianca_chk
  check (nivel_confianca is null or nivel_confianca in ('alta','media','baixa'));

alter table importacoes_boletos drop constraint if exists importacoes_boletos_status_vinculacao_chk;
alter table importacoes_boletos add constraint importacoes_boletos_status_vinculacao_chk
  check (status_vinculacao in ('pendente','analisado','aguardando_confirmacao','vinculado','ignorado'));

-- Compatibilidade com importações já concluídas pela versão anterior.
update importacoes_boletos
set cliente_vinculado_id = cliente_id,
    carne_vinculado_id = carne_id,
    boleto_vinculado_id = boleto_id,
    status_vinculacao = 'vinculado'
where status = 'vinculado'
  and boleto_id is not null
  and status_vinculacao = 'pendente';

update importacoes_boletos
set status_vinculacao = 'aguardando_confirmacao'
where status = 'aguardando_confirmacao'
  and status_vinculacao = 'pendente'
  and boleto_id is not null;

-- A unicidade entre importações é validada no backend no momento da confirmação,
-- evitando falha da migration caso o legado contenha registros repetidos.
-- Histórico permanece no JSONB historico da importação. O backend apenas acrescenta
-- eventos e nunca executa UPDATE/DELETE sobre eventos individuais.
