-- Add optional due_date to project_tasks for overdue tracking.
-- Existing RLS policies cover this column automatically.
alter table public.project_tasks
  add column if not exists due_date date;

create index if not exists project_tasks_due_date_idx on public.project_tasks(due_date)
  where due_date is not null;
