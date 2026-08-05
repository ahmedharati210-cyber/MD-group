-- =============================================================================
-- QA test screenshots (item context + result evidence)
-- =============================================================================

do $$ begin
  create type public.qa_attachment_scope as enum ('item', 'result');
exception when duplicate_object then null;
end $$;

create table if not exists public.qa_test_attachments (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.qa_test_items(id) on delete cascade,
  project_id    uuid not null references public.qa_projects(id) on delete cascade,
  scope         public.qa_attachment_scope not null,
  attempt_id    uuid references public.qa_test_attempts(id) on delete cascade,
  storage_path  text not null,
  mime_type     text not null,
  byte_size     integer not null check (byte_size > 0),
  sort_order    integer not null default 0,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint qa_test_attachments_result_attempt_chk check (
    (scope = 'item' and attempt_id is null)
    or scope = 'result'
  )
);

create index if not exists qa_test_attachments_item_live_idx
  on public.qa_test_attachments(item_id, scope)
  where attempt_id is null;

create index if not exists qa_test_attachments_attempt_idx
  on public.qa_test_attachments(attempt_id)
  where attempt_id is not null;

alter table public.qa_test_attachments enable row level security;

drop policy if exists "qa_test_attachments_select" on public.qa_test_attachments;
create policy "qa_test_attachments_select" on public.qa_test_attachments
  for select using (public.current_has_testing_access());

drop policy if exists "qa_test_attachments_insert" on public.qa_test_attachments;
create policy "qa_test_attachments_insert" on public.qa_test_attachments
  for insert with check (
    public.current_can_interact_testing()
    or public.current_can_manage_testing()
  );

drop policy if exists "qa_test_attachments_delete" on public.qa_test_attachments;
create policy "qa_test_attachments_delete" on public.qa_test_attachments
  for delete using (
    attempt_id is null
    and (
      public.current_can_interact_testing()
      or public.current_can_manage_testing()
    )
  );

grant select, insert, delete on public.qa_test_attachments to authenticated;

-- Stamp result-scoped live attachments onto the new attempt row
create or replace function public._snapshot_qa_test_attempt(
  p_item public.qa_test_items
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
begin
  if p_item.result is null then
    return;
  end if;

  insert into public.qa_test_attempts (
    item_id,
    project_id,
    result,
    result_note,
    severity,
    steps_to_reproduce,
    expected_behavior,
    tested_by,
    tested_at,
    reset_by,
    reset_at
  ) values (
    p_item.id,
    p_item.project_id,
    p_item.result,
    p_item.result_note,
    p_item.severity,
    p_item.steps_to_reproduce,
    p_item.expected_behavior,
    p_item.tested_by,
    p_item.tested_at,
    auth.uid(),
    now()
  )
  returning id into v_attempt_id;

  update public.qa_test_attachments
  set attempt_id = v_attempt_id
  where item_id = p_item.id
    and scope = 'result'
    and attempt_id is null;
end;
$$;

revoke all on function public._snapshot_qa_test_attempt(public.qa_test_items) from public;
