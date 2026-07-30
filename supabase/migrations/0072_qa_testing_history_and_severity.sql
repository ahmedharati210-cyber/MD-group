-- =============================================================================
-- QA Testing: attempt history + structured bug reports
-- - severity / steps_to_reproduce / expected_behavior on qa_test_items
-- - Immutable qa_test_attempts archive (written only via security definer RPCs)
-- - reset_qa_test_item + mark_qa_task_ready_for_test RPCs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Severity enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.qa_test_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Structured bug fields on live items
-- ---------------------------------------------------------------------------
alter table public.qa_test_items
  add column if not exists severity public.qa_test_severity,
  add column if not exists steps_to_reproduce text,
  add column if not exists expected_behavior text;

-- Backfill existing bug rows so the new NOT NULL-style check can be applied.
update public.qa_test_items
set
  severity = coalesce(severity, 'medium'::public.qa_test_severity),
  steps_to_reproduce = case
    when steps_to_reproduce is not null and length(trim(steps_to_reproduce)) > 0
      then steps_to_reproduce
    when result_note is not null and length(trim(result_note)) > 0
      then result_note
    else 'غير موثّق (بيانات قديمة)'
  end
where result = 'bug';

-- result_note still required for bug/improve; severity + steps required for bug
alter table public.qa_test_items
  drop constraint if exists qa_test_items_result_note_check;
alter table public.qa_test_items
  add constraint qa_test_items_result_note_check
  check (
    result is null
    or result = 'pass'
    or (result_note is not null and length(trim(result_note)) > 0)
  );

alter table public.qa_test_items
  drop constraint if exists qa_test_items_bug_details_check;
alter table public.qa_test_items
  add constraint qa_test_items_bug_details_check
  check (
    result is distinct from 'bug'
    or (
      severity is not null
      and steps_to_reproduce is not null
      and length(trim(steps_to_reproduce)) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Immutable attempt history
-- ---------------------------------------------------------------------------
create table if not exists public.qa_test_attempts (
  id                  uuid primary key default gen_random_uuid(),
  item_id             uuid not null references public.qa_test_items(id) on delete cascade,
  project_id          uuid not null references public.qa_projects(id) on delete cascade,
  result              public.qa_test_result not null,
  result_note         text,
  severity            public.qa_test_severity,
  steps_to_reproduce  text,
  expected_behavior   text,
  tested_by           uuid references public.profiles(id) on delete set null,
  tested_at           timestamptz,
  reset_by            uuid references public.profiles(id) on delete set null,
  reset_at            timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists qa_test_attempts_item_idx
  on public.qa_test_attempts(item_id, reset_at desc);
create index if not exists qa_test_attempts_project_idx
  on public.qa_test_attempts(project_id);

alter table public.qa_test_attempts enable row level security;

drop policy if exists "qa_test_attempts_select" on public.qa_test_attempts;
create policy "qa_test_attempts_select" on public.qa_test_attempts
  for select using (public.current_has_testing_access());

-- No insert/update/delete policies — writes only via security definer RPCs below.
grant select on public.qa_test_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Shared archive helper (security definer)
-- ---------------------------------------------------------------------------
create or replace function public._archive_qa_test_result(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.qa_test_items%rowtype;
begin
  select * into v_item
  from public.qa_test_items
  where id = p_item_id
  for update;

  if not found then
    return false;
  end if;

  if v_item.result is null then
    return true;
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
    v_item.id,
    v_item.project_id,
    v_item.result,
    v_item.result_note,
    v_item.severity,
    v_item.steps_to_reproduce,
    v_item.expected_behavior,
    v_item.tested_by,
    v_item.tested_at,
    auth.uid(),
    now()
  );

  update public.qa_test_items
  set
    result = null,
    result_note = null,
    severity = null,
    steps_to_reproduce = null,
    expected_behavior = null,
    tested_by = null,
    tested_at = null
  where id = p_item_id;

  return true;
end;
$$;

revoke all on function public._archive_qa_test_result(uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. Manager reset RPC
-- ---------------------------------------------------------------------------
create or replace function public.reset_qa_test_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_can_manage_testing() then
    raise exception 'only managers can reset test results';
  end if;

  if not public._archive_qa_test_result(p_item_id) then
    raise exception 'qa test item not found';
  end if;
end;
$$;

revoke all on function public.reset_qa_test_item(uuid) from public;
grant execute on function public.reset_qa_test_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Mark task ready for test (interact) — archive any stale result then convert
-- ---------------------------------------------------------------------------
create or replace function public.mark_qa_task_ready_for_test(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.qa_item_kind;
begin
  if not public.current_can_interact_testing() then
    raise exception 'not authorized';
  end if;

  select item_kind into v_kind
  from public.qa_test_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'qa test item not found';
  end if;

  if v_kind is distinct from 'task' then
    raise exception 'this action is for tasks only';
  end if;

  perform public._archive_qa_test_result(p_item_id);

  update public.qa_test_items
  set item_kind = 'test'
  where id = p_item_id;
end;
$$;

revoke all on function public.mark_qa_task_ready_for_test(uuid) from public;
grant execute on function public.mark_qa_task_ready_for_test(uuid) to authenticated;
