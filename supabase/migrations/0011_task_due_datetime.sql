-- Widen due_date from date to timestamptz so tasks can store hour + minute.
-- Existing date values are cast to midnight UTC — no data is lost.
alter table public.project_tasks
  alter column due_date type timestamptz
  using due_date::timestamptz;
