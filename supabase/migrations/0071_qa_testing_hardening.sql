-- =============================================================================
-- QA Testing hardening
-- - Drop unused assigned_to
-- - Lock item_kind for non-managers (allow task → test only)
-- - Owners with testing access: view only (no item updates)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop unused assignee column
-- ---------------------------------------------------------------------------
drop index if exists public.qa_test_items_assigned_idx;

alter table public.qa_test_items
  drop column if exists assigned_to;

-- ---------------------------------------------------------------------------
-- 2. Interact helper — owners may view but not mutate results / convert tasks
-- ---------------------------------------------------------------------------
create or replace function public.current_can_interact_testing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.is_super_admin
        or (
          p.testing_access_enabled
          and p.role is distinct from 'owner'
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.current_can_interact_testing() from public;
grant execute on function public.current_can_interact_testing() to authenticated;

-- Testers (non-owners with access) may update results; owners cannot.
drop policy if exists "qa_test_items_update" on public.qa_test_items;
create policy "qa_test_items_update" on public.qa_test_items
  for update using (public.current_can_interact_testing());

-- ---------------------------------------------------------------------------
-- 3. Restrict tester updates: lock item_kind except task → test
-- ---------------------------------------------------------------------------
create or replace function public.qa_test_items_restrict_tester_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_can_manage_testing() then
    return new;
  end if;

  -- Non-managers: structure columns must stay identical
  if new.section_id is distinct from old.section_id
     or new.project_id is distinct from old.project_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.sort_order is distinct from old.sort_order
  then
    raise exception 'testers can only update test results';
  end if;

  -- item_kind: only allow the intentional task → test conversion
  if new.item_kind is distinct from old.item_kind
     and not (old.item_kind = 'task' and new.item_kind = 'test')
  then
    raise exception 'testers can only convert tasks to tests';
  end if;

  -- Non-managers cannot clear an existing result (manager reset only)
  if old.result is not null and new.result is null then
    raise exception 'only managers can reset test results';
  end if;

  return new;
end;
$$;
