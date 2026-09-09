-- ============================================================================
-- MIGRATION 029: Colaboradores, permissões, comparecimento e comissões
-- Extensão do ecossistema existente. Não duplica clientes, vendas ou boletos.
-- ============================================================================

do $$ begin
  create type cargo_colaborador as enum ('vendedora', 'sdr', 'financeiro', 'administrativo');
exception when duplicate_object then null;
end $$;

create table if not exists colaboradores (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  cargo cargo_colaborador not null,
  ativo boolean not null default true,
  permissoes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists metas_colaboradores (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  meta_minima numeric(12,2) not null default 0,
  percentual_comissao numeric(7,4),
  comissao_estimada numeric(12,2),
  comissao_final numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (colaborador_id, ano, mes)
);

create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete restrict,
  cargo cargo_colaborador not null,
  cliente_id uuid references clientes(id) on delete set null,
  agendamento_id uuid references agendamentos(id) on delete set null,
  boleto_id uuid references boletos(id) on delete set null,
  evento text not null check (evento in ('primeira_parcela_confirmada', 'comparecimento', 'manual_configuracao_financeiro')),
  chave_evento text not null unique,
  valor numeric(12,2) not null check (valor >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'paga')),
  gerado_por uuid references auth.users(id) on delete set null,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notificacoes_colaboradores (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  data_referencia date,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists mensagens_motivacionais (
  id uuid primary key default gen_random_uuid(),
  cargo cargo_colaborador,
  titulo text not null,
  mensagem text not null,
  programada_para timestamptz,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clientes add column if not exists vendedora_id uuid references colaboradores(id) on delete set null;
alter table novas_vendas add column if not exists vendedora_id uuid references colaboradores(id) on delete set null;
alter table agendamentos add column if not exists sdr_id uuid references colaboradores(id) on delete set null;
alter table agendamentos add column if not exists comparecimento_status text check (comparecimento_status in ('pendente', 'compareceu', 'nao_compareceu')) default 'pendente';
alter table agendamentos add column if not exists comparecimento_em timestamptz;
alter table agendamentos add column if not exists comparecimento_registrado_por uuid references auth.users(id) on delete set null;

create index if not exists idx_colaboradores_cargo_ativo on colaboradores(cargo, ativo);
create index if not exists idx_clientes_vendedora on clientes(vendedora_id);
create index if not exists idx_novas_vendas_vendedora on novas_vendas(vendedora_id);
create index if not exists idx_agendamentos_sdr on agendamentos(sdr_id);
create index if not exists idx_agendamentos_comparecimento on agendamentos(comparecimento_status);
create index if not exists idx_comissoes_colaborador_created on comissoes(colaborador_id, created_at desc);
create index if not exists idx_comissoes_cliente_evento on comissoes(cliente_id, evento);
create index if not exists idx_notificacoes_colaborador_created on notificacoes_colaboradores(colaborador_id, created_at desc);
create unique index if not exists uniq_resumo_colaborador_dia on notificacoes_colaboradores(colaborador_id, tipo, data_referencia) where data_referencia is not null;

drop trigger if exists trg_colaboradores_updated_at on colaboradores;
create trigger trg_colaboradores_updated_at before update on colaboradores for each row execute function set_updated_at();
drop trigger if exists trg_metas_colaboradores_updated_at on metas_colaboradores;
create trigger trg_metas_colaboradores_updated_at before update on metas_colaboradores for each row execute function set_updated_at();
drop trigger if exists trg_comissoes_updated_at on comissoes;
create trigger trg_comissoes_updated_at before update on comissoes for each row execute function set_updated_at();
drop trigger if exists trg_mensagens_motivacionais_updated_at on mensagens_motivacionais;
create trigger trg_mensagens_motivacionais_updated_at before update on mensagens_motivacionais for each row execute function set_updated_at();

alter table colaboradores enable row level security;
alter table metas_colaboradores enable row level security;
alter table comissoes enable row level security;
alter table notificacoes_colaboradores enable row level security;
alter table mensagens_motivacionais enable row level security;

drop policy if exists colaborador_self_read on colaboradores;
create policy colaborador_self_read on colaboradores for select using (auth.uid() = auth_user_id);
drop policy if exists colaborador_self_meta on metas_colaboradores;
create policy colaborador_self_meta on metas_colaboradores for select using (exists (select 1 from colaboradores c where c.id = colaborador_id and c.auth_user_id = auth.uid()));
drop policy if exists colaborador_self_comissoes on comissoes;
create policy colaborador_self_comissoes on comissoes for select using (exists (select 1 from colaboradores c where c.id = colaborador_id and c.auth_user_id = auth.uid()));
drop policy if exists colaborador_self_notificacoes on notificacoes_colaboradores;
create policy colaborador_self_notificacoes on notificacoes_colaboradores for select using (exists (select 1 from colaboradores c where c.id = colaborador_id and c.auth_user_id = auth.uid()));
create policy colaborador_self_notificacoes_update on notificacoes_colaboradores for update using (exists (select 1 from colaboradores c where c.id = colaborador_id and c.auth_user_id = auth.uid())) with check (exists (select 1 from colaboradores c where c.id = colaborador_id and c.auth_user_id = auth.uid()));

-- O service_role usado nas Route Handlers é o único caminho para escritas de eventos.
-- A chave única torna reprocessamentos do Admin/RD Station idempotentes.
create or replace function gerar_comissao_vendedora_primeira_parcela(p_boleto_id uuid, p_usuario_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_boleto record;
  v_cliente record;
  v_comissao comissoes;
begin
  select id, cliente_id, numero_parcela, status into v_boleto from boletos where id = p_boleto_id;
  if not found or v_boleto.status <> 'pago' or v_boleto.numero_parcela <> 1 then
    return jsonb_build_object('gerada', false, 'motivo', 'evento_nao_e_primeira_parcela_paga');
  end if;
  select id, vendedora_id into v_cliente from clientes where id = v_boleto.cliente_id;
  if not found or v_cliente.vendedora_id is null then
    return jsonb_build_object('gerada', false, 'motivo', 'vendedora_nao_vinculada');
  end if;
  insert into comissoes (colaborador_id, cargo, cliente_id, boleto_id, evento, chave_evento, valor, status, gerado_por)
  values (v_cliente.vendedora_id, 'vendedora', v_cliente.id, v_boleto.id, 'primeira_parcela_confirmada', 'vendedora:primeira_parcela:' || v_cliente.id, 100, 'pendente', p_usuario_id)
  on conflict (chave_evento) do nothing
  returning * into v_comissao;
  if v_comissao.id is null then
    return jsonb_build_object('gerada', false, 'duplicada', true, 'chave_evento', 'vendedora:primeira_parcela:' || v_cliente.id);
  end if;
  return jsonb_build_object('gerada', true, 'comissao_id', v_comissao.id, 'valor', v_comissao.valor);
end;
$$;

create or replace function gerar_comissao_sdr_comparecimento(p_agendamento_id uuid, p_usuario_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_agendamento record;
  v_comissao comissoes;
begin
  select id, cliente_id, sdr_id, comparecimento_status into v_agendamento from agendamentos where id = p_agendamento_id;
  if not found or v_agendamento.comparecimento_status <> 'compareceu' then
    return jsonb_build_object('gerada', false, 'motivo', 'comparecimento_nao_confirmado');
  end if;
  if v_agendamento.sdr_id is null then
    return jsonb_build_object('gerada', false, 'motivo', 'sdr_nao_vinculada');
  end if;
  insert into comissoes (colaborador_id, cargo, cliente_id, agendamento_id, evento, chave_evento, valor, status, gerado_por)
  values (v_agendamento.sdr_id, 'sdr', v_agendamento.cliente_id, v_agendamento.id, 'comparecimento', 'sdr:comparecimento:' || v_agendamento.id, 10, 'pendente', p_usuario_id)
  on conflict (chave_evento) do nothing
  returning * into v_comissao;
  if v_comissao.id is null then
    return jsonb_build_object('gerada', false, 'duplicada', true, 'chave_evento', 'sdr:comparecimento:' || v_agendamento.id);
  end if;
  return jsonb_build_object('gerada', true, 'comissao_id', v_comissao.id, 'valor', v_comissao.valor);
end;
$$;

grant execute on function gerar_comissao_vendedora_primeira_parcela(uuid, uuid) to service_role;
grant execute on function gerar_comissao_sdr_comparecimento(uuid, uuid) to service_role;

alter publication supabase_realtime add table comissoes;
alter publication supabase_realtime add table notificacoes_colaboradores;