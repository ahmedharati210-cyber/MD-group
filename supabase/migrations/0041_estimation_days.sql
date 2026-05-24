-- Manual estimation days at task, category, and project level (no auto-sum).
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS estimated_days INTEGER;
ALTER TABLE public.project_categories ADD COLUMN IF NOT EXISTS estimated_days INTEGER;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_days INTEGER;
