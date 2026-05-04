-- =============================================================================
-- MD Group — Drop legacy planning tables (migration 0002)
-- These tables were created for a planning module that was later replaced by
-- the projects / project_tasks flow (migrations 0005 + 0006).
-- The UI was removed; the tables are dead weight.
-- =============================================================================

-- Drop in dependency order (attachments/notes reference tasks; tasks reference sites).
-- RLS policies are dropped automatically with the tables.
drop table if exists public.planning_task_attachments;
drop table if exists public.planning_task_notes;
drop table if exists public.planning_tasks;

-- Drop the trigger function that was only used by planning_tasks.
drop function if exists public.touch_planning_task();

-- NOTE: The `sites` table is intentionally kept.
-- It is still referenced by projects.site_id, engineer_reports.site_id, and
-- map_links.site_id as a legacy FK. Projects have replaced sites as the primary
-- work-unit concept; no UI for sites management is needed.
