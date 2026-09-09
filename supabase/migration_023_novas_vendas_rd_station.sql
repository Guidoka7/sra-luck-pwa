-- ============================================================================
-- NOVAS VENDAS / RD STATION
-- Preparação da entrada de vendas concluídas do CRM sem integração ativa.
-- Esta migration NÃO é aplicada automaticamente.
-- ============================================================================

do $$ begin
  create type status_nova_venda as enum (
    'aguardando_cadastro',
    'aguardando_boletos',
    'financeiro_concluido'
  );
exception when duplicate_object then null;
end $$;

create table if not exists novas_vendas (
  id uuid primary key default gen_random_uuid(),
  rd_station_id text not null unique,
  cliente_id uuid references clientes(id) on delete set null,
  nome_completo text not null,
  cpf text,
  telefone text,
  email text,
  data_venda timestamptz not null default now(),
  vendedora_responsavel text,
  valor_contrato numeric(12,2) not null default 0,
  quantidade_parcelas int,
  valor_parcela numeric(12,2),
  taxa_administrativa numeric(8,2),
  tipo_venda text,
  origem_venda text,
  status status_nova_venda not null default 'aguardando_cadastro',
  payload_original jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint novas_vendas_quantidade_parcelas_chk check (quantidade_parcelas is null or quantidade_parcelas > 0),
  constraint novas_vendas_valor_contrato_chk check (valor_contrato >= 0)
);

create index if not exists idx_novas_vendas_status on novas_vendas(status);
create index if not exists idx_novas_vendas_data_venda on novas_vendas(data_venda desc);
create index if not exists idx_novas_vendas_cliente on novas_vendas(cliente_id);
create index if not exists idx_novas_vendas_cpf on novas_vendas(cpf);

-- Garante updated_at usando a função já existente no projeto.
drop trigger if exists trg_novas_vendas_updated_at on novas_vendas;
create trigger trg_novas_vendas_updated_at before update on novas_vendas
  for each row execute function set_updated_at();

alter table novas_vendas enable row level security;

drop policy if exists "admin_full_access_novas_vendas" on novas_vendas;
create policy "admin_full_access_novas_vendas" on novas_vendas
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- A API do webhook usa service_role no servidor; a tabela nunca é acessada
-- diretamente pelo navegador da cliente.
