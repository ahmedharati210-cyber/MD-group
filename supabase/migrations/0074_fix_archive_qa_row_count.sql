-- Fix: _archive_qa_test_result compared ROW_COUNT (integer) via a boolean
-- variable, causing "operator does not exist: boolean > integer" on edit/reset.
create or replace function public._archive_qa_test_result(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
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

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
