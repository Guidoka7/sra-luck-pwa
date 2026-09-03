-- ============================================================================
-- MIGRATION 028: Armazenamento seguro e reprocessamento de PDFs de boletos
-- Preserva PDFs originais para permitir nova leitura sem novo upload.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boletos-pdf', 'boletos-pdf', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "authenticated_read_boletos_pdf" on storage.objects;
create policy "authenticated_read_boletos_pdf"
on storage.objects for select to authenticated
using (bucket_id = 'boletos-pdf');

drop policy if exists "authenticated_insert_boletos_pdf" on storage.objects;
create policy "authenticated_insert_boletos_pdf"
on storage.objects for insert to authenticated
with check (bucket_id = 'boletos-pdf');

drop policy if exists "authenticated_update_boletos_pdf" on storage.objects;
create policy "authenticated_update_boletos_pdf"
on storage.objects for update to authenticated
using (bucket_id = 'boletos-pdf')
with check (bucket_id = 'boletos-pdf');

drop policy if exists "authenticated_delete_boletos_pdf" on storage.objects;
create policy "authenticated_delete_boletos_pdf"
on storage.objects for delete to authenticated
using (bucket_id = 'boletos-pdf');

create index if not exists idx_importacoes_boletos_storage_path
on importacoes_boletos(arquivo_storage_path)
where arquivo_storage_path is not null;

comment on column importacoes_boletos.arquivo_storage_path is
'PDF original no bucket privado boletos-pdf, necessário para reprocessamento visual seguro.';
