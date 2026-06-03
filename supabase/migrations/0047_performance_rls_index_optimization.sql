-- Migration: Performance, RLS, and Index Optimization
-- Implements the findings from the MD-Group Supabase audit.
-- See: supabase_audit_&_plan_b1094fb5.plan.md

-- ============================================================
-- 1. Fix push_subscriptions RLS initialization plan
--    Use (SELECT auth.uid()) so Postgres evaluates the auth
--    function once per query instead of once per row.
-- ============================================================
ALTER POLICY push_subscriptions_delete_own ON public.push_subscriptions
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY push_subscriptions_select_own ON public.push_subscriptions
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY push_subscriptions_insert_own ON public.push_subscriptions
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY push_subscriptions_update_own ON public.push_subscriptions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 2. Consolidate multiple permissive RLS policies
--    Replace overlapping ALL + SELECT policies with exactly
--    one policy per operation per table.
-- ============================================================

-- profiles (8 → 5 policies)
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
DROP POLICY IF EXISTS profiles_manager_read ON public.profiles;
DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;

CREATE POLICY profiles_read ON public.profiles
FOR SELECT USING (
  ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
  OR current_is_owner()
  OR id = (SELECT auth.uid())
);

-- documents (4 → 4 per-operation policies)
DROP POLICY IF EXISTS documents_admin ON public.documents;
DROP POLICY IF EXISTS documents_manager ON public.documents;
DROP POLICY IF EXISTS documents_employee_personal ON public.documents;
DROP POLICY IF EXISTS documents_owner_select ON public.documents;

CREATE POLICY documents_select ON public.documents FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
  OR current_is_owner()
  OR ("current_role"() = 'employee'::user_role AND (
    owner_profile_id = (SELECT auth.uid())
    OR (company_id = current_company() AND category = ANY (ARRAY['memo'::document_category, 'letter'::document_category]))
  ))
);
CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);
CREATE POLICY documents_update ON public.documents FOR UPDATE
  USING ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()))
  WITH CHECK ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()));
CREATE POLICY documents_delete ON public.documents FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);

-- engineer_reports (4 → 4 per-operation policies)
DROP POLICY IF EXISTS reports_md_admin_all ON public.engineer_reports;
DROP POLICY IF EXISTS reports_company_manager_all ON public.engineer_reports;
DROP POLICY IF EXISTS reports_employee_own ON public.engineer_reports;
DROP POLICY IF EXISTS reports_owner_select ON public.engineer_reports;

CREATE POLICY reports_select ON public.engineer_reports FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
  OR (author_id = (SELECT auth.uid()) AND "current_role"() = 'employee'::user_role)
  OR current_is_owner()
);
CREATE POLICY reports_insert ON public.engineer_reports FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
  OR (author_id = (SELECT auth.uid()) AND "current_role"() = 'employee'::user_role)
);
CREATE POLICY reports_update ON public.engineer_reports FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
  OR (author_id = (SELECT auth.uid()) AND "current_role"() = 'employee'::user_role)
);
CREATE POLICY reports_delete ON public.engineer_reports FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
  OR (author_id = (SELECT auth.uid()) AND "current_role"() = 'employee'::user_role)
);

-- mail (3 → 4 per-operation policies)
DROP POLICY IF EXISTS mail_admin ON public.mail;
DROP POLICY IF EXISTS mail_manager ON public.mail;
DROP POLICY IF EXISTS mail_owner_select ON public.mail;

CREATE POLICY mail_select ON public.mail FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
  OR current_is_owner()
);
CREATE POLICY mail_insert ON public.mail FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);
CREATE POLICY mail_update ON public.mail FOR UPDATE
  USING ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()))
  WITH CHECK ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()));
CREATE POLICY mail_delete ON public.mail FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);

-- manager_claims (3 → 4 per-operation policies)
DROP POLICY IF EXISTS claims_md_admin_all ON public.manager_claims;
DROP POLICY IF EXISTS claims_company_manager_all ON public.manager_claims;
DROP POLICY IF EXISTS claims_owner_select ON public.manager_claims;

CREATE POLICY claims_select ON public.manager_claims FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
  OR current_is_owner()
);
CREATE POLICY claims_insert ON public.manager_claims FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY claims_update ON public.manager_claims FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY claims_delete ON public.manager_claims FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);

-- map_links (4 → 4 per-operation policies)
DROP POLICY IF EXISTS maps_md_admin_all ON public.map_links;
DROP POLICY IF EXISTS maps_company_manager_all ON public.map_links;
DROP POLICY IF EXISTS maps_employee_select ON public.map_links;
DROP POLICY IF EXISTS maps_owner_select ON public.map_links;

CREATE POLICY maps_select ON public.map_links FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
  OR current_is_owner()
);
CREATE POLICY maps_insert ON public.map_links FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY maps_update ON public.map_links FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY maps_delete ON public.map_links FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);

-- projects (4 → 4 per-operation policies)
DROP POLICY IF EXISTS projects_md_admin_all ON public.projects;
DROP POLICY IF EXISTS projects_company_manager_all ON public.projects;
DROP POLICY IF EXISTS projects_employee_select ON public.projects;
DROP POLICY IF EXISTS projects_owner_select ON public.projects;

CREATE POLICY projects_select ON public.projects FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
  OR current_is_owner()
);
CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY projects_update ON public.projects FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY projects_delete ON public.projects FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() = 'company_manager'::user_role)
);

-- project_categories (4 → 4 per-operation policies)
DROP POLICY IF EXISTS categories_md_admin_all ON public.project_categories;
DROP POLICY IF EXISTS categories_company_manager_all ON public.project_categories;
DROP POLICY IF EXISTS categories_employee_select ON public.project_categories;
DROP POLICY IF EXISTS categories_owner_select ON public.project_categories;

CREATE POLICY categories_select ON public.project_categories FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
  OR current_is_owner()
);
CREATE POLICY categories_insert ON public.project_categories FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY categories_update ON public.project_categories FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY categories_delete ON public.project_categories FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() = 'company_manager'::user_role)
);

-- project_tasks (5 → 4 per-operation policies)
DROP POLICY IF EXISTS tasks_md_admin_all ON public.project_tasks;
DROP POLICY IF EXISTS tasks_company_manager_all ON public.project_tasks;
DROP POLICY IF EXISTS tasks_employee_select ON public.project_tasks;
DROP POLICY IF EXISTS tasks_owner_select ON public.project_tasks;
DROP POLICY IF EXISTS tasks_employee_update ON public.project_tasks;

CREATE POLICY tasks_select ON public.project_tasks FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
  OR current_is_owner()
);
CREATE POLICY tasks_insert ON public.project_tasks FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() = 'company_manager'::user_role)
);
CREATE POLICY tasks_update ON public.project_tasks FOR UPDATE USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
);
CREATE POLICY tasks_delete ON public.project_tasks FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ((SELECT p.company_id FROM projects p WHERE p.id = project_id) = current_company()
      AND "current_role"() = 'company_manager'::user_role)
);

-- sites (3 → 4 per-operation policies)
DROP POLICY IF EXISTS sites_admin ON public.sites;
DROP POLICY IF EXISTS sites_manager ON public.sites;
DROP POLICY IF EXISTS sites_employee_read ON public.sites;

CREATE POLICY sites_select ON public.sites FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR (company_id = current_company() AND "current_role"() IN ('company_manager'::user_role, 'employee'::user_role))
);
CREATE POLICY sites_insert ON public.sites FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);
CREATE POLICY sites_update ON public.sites FOR UPDATE
  USING ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()))
  WITH CHECK ("current_role"() = 'md_admin'::user_role OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company()));
CREATE POLICY sites_delete ON public.sites FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
);

-- ============================================================
-- 3. Drop 23 unused indexes to free shared_buffers and speed
--    up writes. Kept: search/trgm GIN indexes, composite query
--    indexes, and the expiry notification index.
-- ============================================================
DROP INDEX IF EXISTS public.engineer_requests_company_idx;
DROP INDEX IF EXISTS public.mail_direction_idx;
DROP INDEX IF EXISTS public.audit_log_entity_idx;
DROP INDEX IF EXISTS public.projects_company_idx;
DROP INDEX IF EXISTS public.sites_company_idx;
DROP INDEX IF EXISTS public.manager_claims_company_idx;
DROP INDEX IF EXISTS public.map_links_company_idx;
DROP INDEX IF EXISTS public.warnings_company_idx;
DROP INDEX IF EXISTS public.idx_manager_claims_created_by;
DROP INDEX IF EXISTS public.idx_map_links_site_id;
DROP INDEX IF EXISTS public.idx_map_links_created_by;
DROP INDEX IF EXISTS public.project_tasks_project_idx;
DROP INDEX IF EXISTS public.manager_claims_project_id_idx;
DROP INDEX IF EXISTS public.idx_projects_site_id;
DROP INDEX IF EXISTS public.idx_projects_created_by;
DROP INDEX IF EXISTS public.idx_warnings_sender_id;
DROP INDEX IF EXISTS public.profiles_role_created_idx;
DROP INDEX IF EXISTS public.project_personal_drafts_project_idx;
DROP INDEX IF EXISTS public.employee_signup_requests_invite_token_idx;
DROP INDEX IF EXISTS public.idx_documents_created_by;
DROP INDEX IF EXISTS public.idx_documents_owner_profile_id;
DROP INDEX IF EXISTS public.idx_engineer_reports_site_id;
DROP INDEX IF EXISTS public.idx_engineer_requests_responded_by;

-- ============================================================
-- 4. Add covering indexes for unindexed foreign key columns
-- ============================================================
CREATE INDEX IF NOT EXISTS employee_directory_created_by_idx
  ON public.employee_directory (created_by);

CREATE INDEX IF NOT EXISTS employee_signup_requests_invite_id_idx
  ON public.employee_signup_requests (invite_id);

CREATE INDEX IF NOT EXISTS project_personal_drafts_category_id_idx
  ON public.project_personal_drafts (category_id);

-- ============================================================
-- 5. Security: revoke anon EXECUTE from SECURITY DEFINER
--    functions that should only be called by authenticated users
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.current_is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.documents_due_for_expiry_notification() FROM anon;

-- ============================================================
-- 6. Enable extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 7. Schedule pg_cron maintenance jobs
-- ============================================================

-- Nightly VACUUM ANALYZE on the six most-accessed tables (2:30am UTC).
-- Keeps query plans fresh and reclaims dead-row space without autovacuum lag.
SELECT cron.schedule(
  'nightly-vacuum-analyze',
  '30 2 * * *',
  $$VACUUM ANALYZE public.profiles, public.documents, public.projects, public.project_tasks, public.warnings, public.engineer_requests$$
);

-- Weekly pg_stat_statements reset (Sunday 3am UTC) so the performance advisor
-- and advisor dashboards always show recent data.
SELECT cron.schedule(
  'weekly-stat-reset',
  '0 3 * * 0',
  $$SELECT pg_stat_statements_reset()$$
);

-- ============================================================
-- 8. Move pg_trgm from public to extensions schema
--    Prevents PostgREST from exposing trigram functions directly
--    via the REST API.
-- ============================================================
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ============================================================
-- 9. Reduce work_mem from 128MB to 16MB
--    Applies to all new connections to this database.
--    Frees ~500MB of potential working memory under concurrent load.
-- ============================================================
ALTER DATABASE postgres SET work_mem = '16MB';

-- ============================================================
-- 10. Complete profiles RLS consolidation
--     Replace 3 ALL policies + profiles_self_update with
--     exactly 4 per-operation policies, eliminating all
--     "multiple permissive policies" advisor warnings.
-- ============================================================
DROP POLICY IF EXISTS profiles_admin_write  ON public.profiles;
DROP POLICY IF EXISTS profiles_manager_write ON public.profiles;
DROP POLICY IF EXISTS profiles_super_admin  ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update  ON public.profiles;
DROP POLICY IF EXISTS profiles_read         ON public.profiles;

-- SELECT: admin | manager (all company rows) | super_admin | owner | self
CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company())
  OR current_is_super_admin()
  OR current_is_owner()
  OR id = (SELECT auth.uid())
);

-- INSERT: admin | manager inserts employees in own company | super_admin
CREATE POLICY profiles_insert ON public.profiles
FOR INSERT WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company() AND role = 'employee'::user_role)
  OR current_is_super_admin()
);

-- UPDATE: admin | manager updates employees in own company | super_admin | self (role locked)
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE
USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company() AND role = 'employee'::user_role)
  OR current_is_super_admin()
  OR id = (SELECT auth.uid())
)
WITH CHECK (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company() AND role = 'employee'::user_role)
  OR current_is_super_admin()
  OR (id = (SELECT auth.uid()) AND role = "current_role"())
);

-- DELETE: admin | manager deletes employees in own company | super_admin
CREATE POLICY profiles_delete ON public.profiles
FOR DELETE USING (
  "current_role"() = 'md_admin'::user_role
  OR ("current_role"() = 'company_manager'::user_role AND company_id = current_company() AND role = 'employee'::user_role)
  OR current_is_super_admin()
);

-- ============================================================
-- 11. Recreate all FK covering indexes
--     Previously dropped as "unused" but required for JOIN/CASCADE
--     correctness and will be used as tables grow.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_created_by                ON public.documents (created_by);
CREATE INDEX IF NOT EXISTS idx_documents_owner_profile_id          ON public.documents (owner_profile_id);
CREATE INDEX IF NOT EXISTS employee_signup_invites_created_by_idx  ON public.employee_signup_invites (created_by);
CREATE INDEX IF NOT EXISTS employee_signup_requests_created_by_idx ON public.employee_signup_requests (created_by);
CREATE INDEX IF NOT EXISTS employee_signup_requests_reviewed_by_idx ON public.employee_signup_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_engineer_reports_site_id            ON public.engineer_reports (site_id);
CREATE INDEX IF NOT EXISTS engineer_requests_company_id_idx        ON public.engineer_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_engineer_requests_responded_by      ON public.engineer_requests (responded_by);
CREATE INDEX IF NOT EXISTS manager_claims_company_id_idx           ON public.manager_claims (company_id);
CREATE INDEX IF NOT EXISTS idx_manager_claims_created_by           ON public.manager_claims (created_by);
CREATE INDEX IF NOT EXISTS manager_claims_project_id_idx           ON public.manager_claims (project_id);
CREATE INDEX IF NOT EXISTS map_links_company_id_idx                ON public.map_links (company_id);
CREATE INDEX IF NOT EXISTS idx_map_links_created_by                ON public.map_links (created_by);
CREATE INDEX IF NOT EXISTS idx_map_links_site_id                   ON public.map_links (site_id);
CREATE INDEX IF NOT EXISTS project_personal_drafts_project_id_idx  ON public.project_personal_drafts (project_id);
CREATE INDEX IF NOT EXISTS project_tasks_project_id_idx            ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS projects_company_id_idx                 ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by                 ON public.projects (created_by);
CREATE INDEX IF NOT EXISTS idx_projects_site_id                    ON public.projects (site_id);
CREATE INDEX IF NOT EXISTS sites_company_id_idx                    ON public.sites (company_id);
CREATE INDEX IF NOT EXISTS warnings_company_id_idx                 ON public.warnings (company_id);
CREATE INDEX IF NOT EXISTS idx_warnings_sender_id                  ON public.warnings (sender_id);

-- Drop one remaining truly-unused non-FK index
DROP INDEX IF EXISTS public.documents_category_idx;

-- ============================================================
-- 12. Tighten documents_due_for_expiry_notification() access
--     This SECURITY DEFINER function bypasses RLS and returns
--     ALL expiring documents across all companies. Revoke from
--     authenticated — only the cron/service_role backend needs it.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.documents_due_for_expiry_notification() FROM authenticated;
