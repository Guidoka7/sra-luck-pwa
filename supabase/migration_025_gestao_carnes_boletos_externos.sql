-- ============================================================================
-- MIGRATION 025: Gestão de Carnês e Boletos Externos
-- Registro de carnês e boletos gerados externamente. NÃO executar automaticamente.
-- ============================================================================

do $$ begin
  create type status_carne as enum ('ativo', 'concluido');
exception when duplicate_object then null;
end $$;

create table if not exists carnes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  instituicao_financeira text not null,
  identificador_externo text not null,
  data_geracao date not null,
  quantidade_parcelas integer not null check (quantidade_parcelas > 0),
  valor_parcela numeric(12,2) not null check (valor_parcela >= 0),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  status status_carne not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carnes_instituicao_chk check (length(trim(instituicao_financeira)) > 0),
  constraint carnes_identificador_chk check (length(trim(identificador_externo)) > 0)
);

alter table boletos add column if not exists carne_id uuid references carnes(id) on delete set null;
alter table boletos add column if not exists instituicao_financeira text;
alter table boletos add column if not exists identificador_externo text;
alter table boletos add column if not exists origem_boleto text not null default 'sistema';

create index if not exists idx_carnes_cliente on carnes(cliente_id);
create index if not exists idx_carnes_instituicao on carnes(lower(trim(instituicao_financeira)));
create index if not exists idx_carnes_data_geracao on carnes(data_geracao desc);
create index if not exists idx_carnes_status on carnes(status);
create unique index if not exists uniq_carne_instituicao_identificador
  on carnes(lower(trim(instituicao_financeira)), lower(trim(identificador_externo)));
create index if not exists idx_boletos_carne on boletos(carne_id);
create index if not exists idx_boletos_instituicao_identificador
  on boletos(lower(trim(instituicao_financeira)), lower(trim(identificador_externo)))
  where identificador_externo is not null and length(trim(identificador_externo)) > 0;

-- Um boleto externo fica claramente distinguido dos boletos criados pelo sistema.
alter table boletos drop constraint if exists boletos_origem_boleto_chk;
alter table boletos add constraint boletos_origem_boleto_chk
  check (origem_boleto in ('sistema', 'externo'));

-- Mantém updated_at alinhado ao padrão existente.
drop trigger if exists trg_carnes_updated_at on carnes;
create trigger trg_carnes_updated_at before update on carnes
  for each row execute function set_updated_at();

alter table carnes enable row level security;
drop policy if exists "admin_full_access_carnes" on carnes;
create policy "admin_full_access_carnes" on carnes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Os boletos continuam sob a política administrativa existente; a FK apenas
-- cria o agrupamento Carnê -> Boleto sem alterar o fluxo de baixa.
