-- ============================================================================
-- MIGRATION 025: Exclusão definitiva de cliente
--
-- Garante que qualquer tabela que possua uma FK para clientes(id) também
-- seja removida quando a cliente for excluída pelo painel administrativo.
-- Isso corrige exclusões que falham quando novas tabelas/migrações adicionam
-- referências à cliente sem ON DELETE CASCADE.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      con.conname as constraint_name
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_n on parent_n.oid = parent.relnamespace
    where con.contype = 'f'
      and parent_n.nspname = 'public'
      and parent.relname = 'clientes'
      and c.relname <> 'clientes'
      and n.nspname = 'public'
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      r.schema_name,
      r.table_name,
      r.constraint_name
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (cliente_id) references public.clientes(id) on delete cascade',
      r.schema_name,
      r.table_name,
      r.constraint_name
    );
  end loop;
end $$;
