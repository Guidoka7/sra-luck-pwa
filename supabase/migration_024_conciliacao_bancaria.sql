-- ============================================================================
-- MIGRATION 024: Central de Conciliação Bancária
-- Preparação interna para recebimentos bancários. NÃO executada automaticamente.
-- ============================================================================

do $$ begin
  create type status_conciliacao_pagamento as enum (
    'pendente',
    'conciliado',
    'nao_identificado',
    'divergencia',
    'ignorado'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type metodo_conciliacao_pagamento as enum ('boleto', 'pix', 'outro');
exception when duplicate_object then null;
end $$;

create table if not exists conciliacao_pagamentos (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  identificador_externo text,
  cliente_id uuid references clientes(id) on delete set null,
  boleto_id uuid references boletos(id) on delete set null,
  data_pagamento date not null,
  valor_recebido numeric(12,2) not null,
  metodo_pagamento metodo_conciliacao_pagamento not null,
  status status_conciliacao_pagamento not null default 'pendente',
  dados_origem jsonb,
  observacao text,
  motivo_divergencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conciliacao_pagamentos_valor_chk check (valor_recebido >= 0),
  constraint conciliacao_pagamentos_banco_chk check (length(trim(banco)) > 0),
  constraint conciliacao_pagamentos_divergencia_chk check (
    status <> 'divergencia' or length(trim(coalesce(motivo_divergencia, ''))) > 0
  ),
  constraint conciliacao_pagamentos_ignorado_chk check (
    status <> 'ignorado' or length(trim(coalesce(observacao, motivo_divergencia, ''))) > 0
  )
);

-- Um identificador externo só pode existir uma vez para o mesmo banco.
create unique index if not exists uniq_conciliacao_banco_identificador
  on conciliacao_pagamentos(lower(trim(banco)), identificador_externo)
  where identificador_externo is not null and length(trim(identificador_externo)) > 0;

create index if not exists idx_conciliacao_data_pagamento
  on conciliacao_pagamentos(data_pagamento desc);
create index if not exists idx_conciliacao_status
  on conciliacao_pagamentos(status);
create index if not exists idx_conciliacao_banco
  on conciliacao_pagamentos(lower(trim(banco)));
create index if not exists idx_conciliacao_cliente
  on conciliacao_pagamentos(cliente_id);
create index if not exists idx_conciliacao_boleto
  on conciliacao_pagamentos(boleto_id);

-- Histórico é deliberadamente append-only: não há políticas de UPDATE/DELETE.
create table if not exists conciliacao_pagamentos_historico (
  id uuid primary key default gen_random_uuid(),
  conciliacao_pagamento_id uuid not null references conciliacao_pagamentos(id) on delete cascade,
  usuario text not null,
  created_at timestamptz not null default now(),
  status_anterior status_conciliacao_pagamento,
  status_novo status_conciliacao_pagamento not null,
  cliente_id uuid references clientes(id) on delete set null,
  boleto_id uuid references boletos(id) on delete set null,
  observacao text,
  motivo_divergencia text
);

create index if not exists idx_conciliacao_historico_pagamento
  on conciliacao_pagamentos_historico(conciliacao_pagamento_id, created_at desc);
create index if not exists idx_conciliacao_historico_created_at
  on conciliacao_pagamentos_historico(created_at desc);

-- updated_at segue a função já existente no projeto.
drop trigger if exists trg_conciliacao_pagamentos_updated_at on conciliacao_pagamentos;
create trigger trg_conciliacao_pagamentos_updated_at before update on conciliacao_pagamentos
  for each row execute function set_updated_at();

alter table conciliacao_pagamentos enable row level security;
alter table conciliacao_pagamentos_historico enable row level security;

drop policy if exists "admin_full_access_conciliacao_pagamentos" on conciliacao_pagamentos;
create policy "admin_full_access_conciliacao_pagamentos" on conciliacao_pagamentos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "admin_insert_conciliacao_historico" on conciliacao_pagamentos_historico;
create policy "admin_insert_conciliacao_historico" on conciliacao_pagamentos_historico
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "admin_select_conciliacao_historico" on conciliacao_pagamentos_historico;
create policy "admin_select_conciliacao_historico" on conciliacao_pagamentos_historico
  for select using (auth.role() = 'authenticated');

-- Nenhuma política de UPDATE/DELETE é criada para o histórico: registros imutáveis.
