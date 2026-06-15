-- Per-task work status: null = not started, 'in_progress' = actively being worked on.
alter table public.project_tasks
  add column task_status text
    check (task_status in ('in_progress'))
    default null;
