-- ============================================================================
-- MIGRATION 026: Importação inteligente de boletos em PDF
-- Controle das importações. NÃO executar automaticamente.
-- ============================================================================

do $$ begin
  create type status_importacao_boleto as enum (
    'processando',
    'aguardando_vinculacao',
    'aguardando_confirmacao',
    'vinculado',
    'erro'
  );
exception when duplicate_object then null;
end $$;

create table if not exists importacoes_boletos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  carne_id uuid references carnes(id) on delete set null,
  boleto_id uuid references boletos(id) on delete set null,
  instituicao_financeira text,
  nosso_numero text,
  numero_documento text,
  identificador_externo text,
  linha_digitavel text,
  codigo_barras text,
  nome_pagador_extraido text,
  cpf_pagador_extraido text,
  valor_extraido numeric(12,2),
  vencimento_extraido date,
  numero_parcela integer,
  dados_extraidos jsonb not null default '{}'::jsonb,
  arquivo_nome text,
  arquivo_mime text,
  arquivo_tamanho bigint,
  arquivo_sha256 text,
  arquivo_storage_path text,
  historico jsonb not null default '[]'::jsonb,
  status status_importacao_boleto not null default 'processando',
  erro_detalhes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_importacoes_boletos_cliente on importacoes_boletos(cliente_id);
create index if not exists idx_importacoes_boletos_carne on importacoes_boletos(carne_id);
create index if not exists idx_importacoes_boletos_boleto on importacoes_boletos(boleto_id);
create index if not exists idx_importacoes_boletos_status on importacoes_boletos(status);
create index if not exists idx_importacoes_boletos_created_at on importacoes_boletos(created_at desc);
create index if not exists idx_importacoes_boletos_instituicao on importacoes_boletos(lower(trim(instituicao_financeira)));

create unique index if not exists uniq_importacao_boleto_instituicao_nosso
  on importacoes_boletos(lower(trim(instituicao_financeira)), lower(trim(nosso_numero)))
  where instituicao_financeira is not null
    and nosso_numero is not null
    and length(trim(instituicao_financeira)) > 0
    and length(trim(nosso_numero)) > 0;

create unique index if not exists uniq_importacao_boleto_instituicao_externo
  on importacoes_boletos(lower(trim(instituicao_financeira)), lower(trim(identificador_externo)))
  where instituicao_financeira is not null
    and identificador_externo is not null
    and length(trim(instituicao_financeira)) > 0
    and length(trim(identificador_externo)) > 0;

create unique index if not exists uniq_importacao_boleto_arquivo_sha256
  on importacoes_boletos(arquivo_sha256)
  where arquivo_sha256 is not null and length(trim(arquivo_sha256)) > 0;

drop trigger if exists trg_importacoes_boletos_updated_at on importacoes_boletos;
create trigger trg_importacoes_boletos_updated_at before update on importacoes_boletos
  for each row execute function set_updated_at();

alter table importacoes_boletos enable row level security;
drop policy if exists "admin_full_access_importacoes_boletos" on importacoes_boletos;
create policy "admin_full_access_importacoes_boletos" on importacoes_boletos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- O arquivo original só recebe storage_path quando houver Storage seguro já
-- configurado. Esta migration não cria bucket nem altera Storage.
