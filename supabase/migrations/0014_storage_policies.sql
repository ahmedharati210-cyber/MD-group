-- Ensure the documents bucket exists (safe to run multiple times)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Drop existing storage policies if any (idempotent)
drop policy if exists "storage_documents_admin_insert"   on storage.objects;
drop policy if exists "storage_documents_manager_insert" on storage.objects;
drop policy if exists "storage_documents_admin_select"   on storage.objects;
drop policy if exists "storage_documents_manager_select" on storage.objects;
drop policy if exists "storage_documents_admin_delete"   on storage.objects;
drop policy if exists "storage_documents_manager_delete" on storage.objects;

-- md_admin: full access
create policy "storage_documents_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) = 'md_admin'
  );

create policy "storage_documents_admin_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) = 'md_admin'
  );

create policy "storage_documents_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) = 'md_admin'
  );

-- company_manager: upload and read files (claims PDFs, papers)
create policy "storage_documents_manager_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "storage_documents_manager_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) in ('company_manager', 'employee')
  );

create policy "storage_documents_manager_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );
