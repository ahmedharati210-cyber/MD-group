-- Per-manager project notification grant (super admin toggles per profile).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS project_notifications_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.project_notifications_enabled IS
  'When true, manager receives automated project/task notifications for their company.';

-- Dedup guard: cron marks tasks after the 3-day-due notification is sent.
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS task_due_notified_at timestamptz;
