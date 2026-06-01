-- Countdown anchor: the date the estimated_days value was last set.
-- Remaining = estimated_days - (today - estimated_days_set_at).
ALTER TABLE public.project_tasks       ADD COLUMN IF NOT EXISTS estimated_days_set_at DATE;
ALTER TABLE public.project_categories  ADD COLUMN IF NOT EXISTS estimated_days_set_at DATE;
ALTER TABLE public.projects            ADD COLUMN IF NOT EXISTS estimated_days_set_at DATE;
