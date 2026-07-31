-- =============================================================================
-- QA Testing security hardening (audit P0)
-- - Lock testing_access_enabled / is_super_admin on profiles
-- - Harden tester update trigger (no overwrite, force tested_by, lock created_at)
-- - Archive live results on clear/change (trigger); RPCs only clear
-- - task→test only via mark_qa_task_ready_for_test RPC for non-managers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lock privileged profile columns (non-superadmin cannot change)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_lock_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_is_super_admin() then
    return new;
  end if;

  if new.testing_access_enabled is distinct from old.testing_access_enabled then
    raise exception 'only superadmins can change testing_access_enabled';
  end if;

  if new.is_super_admin is distinct from old.is_super_admin then
    raise exception 'only superadmins can change is_super_admin';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_lock_privileged_columns on public.profiles;
create trigger profiles_lock_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_lock_privileged_columns();

revoke all on function public.profiles_lock_privileged_columns() from public;

-- ---------------------------------------------------------------------------
-- 2. Snapshot helper (insert only — does not clear the live row)
-- ---------------------------------------------------------------------------
create or replace function public._snapshot_qa_test_attempt(
  p_item public.qa_test_items
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  );
end;
$$;

revoke all on function public._snapshot_qa_test_attempt(public.qa_test_items) from public;

-- ---------------------------------------------------------------------------
-- 3. Harden tester restrict + archive on result clear/change (all roles)
-- ---------------------------------------------------------------------------
create or replace function public.qa_test_items_restrict_tester_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rpc_kind text;
begin
  if not public.current_can_manage_testing() then
    -- Non-managers: structure columns must stay identical
    if new.section_id is distinct from old.section_id
       or new.project_id is distinct from old.project_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.sort_order is distinct from old.sort_order
       or new.created_at is distinct from old.created_at
    then
      raise exception 'testers can only update test results';
    end if;

    -- item_kind: only via mark_qa_task_ready_for_test RPC
    if new.item_kind is distinct from old.item_kind then
      v_rpc_kind := nullif(current_setting('app.qa_rpc_kind_change', true), '');
      if not (
        v_rpc_kind = '1'
        and old.item_kind = 'task'
        and new.item_kind = 'test'
      ) then
        raise exception 'testers can only convert tasks via mark ready RPC';
      end if;
    end if;

    -- Cannot clear or overwrite an existing result, except RPC clear
    -- (mark_qa_task_ready_for_test / _archive_qa_test_result).
    if old.result is not null then
      if nullif(current_setting('app.qa_rpc_clear_result', true), '') = '1'
         and new.result is null
      then
        perform public._snapshot_qa_test_attempt(old);
        return new;
      end if;
      raise exception 'only managers can reset or change existing test results';
    end if;

    -- Force provenance on first submit
    if new.result is not null then
      new.tested_by := auth.uid();
      new.tested_at := coalesce(new.tested_at, now());
    end if;

    return new;
  end if;

  -- Managers: archive whenever a live result is cleared or replaced
  if old.result is not null
     and (
       new.result is null
       or new.result is distinct from old.result
     )
  then
    perform public._snapshot_qa_test_attempt(old);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Rewrite _archive_qa_test_result to clear only (trigger snapshots)
-- ---------------------------------------------------------------------------
create or replace function public._archive_qa_test_result(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  -- Allow non-managers to clear via this RPC path (trigger archives).
  perform set_config('app.qa_rpc_clear_result', '1', true);

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

  get diagnostics v_found = row_count;
  return v_found > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. mark_qa_task_ready_for_test — set RPC flag for kind change
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

  -- Clear any stale result (trigger archives)
  perform public._archive_qa_test_result(p_item_id);

  perform set_config('app.qa_rpc_kind_change', '1', true);

  update public.qa_test_items
  set item_kind = 'test'
  where id = p_item_id;
end;
$$;
