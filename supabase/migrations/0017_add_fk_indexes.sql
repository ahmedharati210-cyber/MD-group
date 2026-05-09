-- Add covering indexes on all unindexed foreign key columns.
-- Missing FK indexes cause full table scans on JOIN queries and on
-- cascading delete operations. All use IF NOT EXISTS for safety.

-- documents
create index if not exists idx_documents_created_by
  on public.documents (created_by);

create index if not exists idx_documents_owner_profile_id
  on public.documents (owner_profile_id);

-- engineer_reports
create index if not exists idx_engineer_reports_site_id
  on public.engineer_reports (site_id);

-- engineer_requests
create index if not exists idx_engineer_requests_responded_by
  on public.engineer_requests (responded_by);

-- mail
create index if not exists idx_mail_created_by
  on public.mail (created_by);

create index if not exists idx_mail_related_document_id
  on public.mail (related_document_id);

-- manager_claims
create index if not exists idx_manager_claims_created_by
  on public.manager_claims (created_by);

-- map_links
create index if not exists idx_map_links_site_id
  on public.map_links (site_id);

create index if not exists idx_map_links_created_by
  on public.map_links (created_by);

-- project_tasks
create index if not exists idx_project_tasks_assigned_to
  on public.project_tasks (assigned_to);

create index if not exists idx_project_tasks_completed_by
  on public.project_tasks (completed_by);

-- projects
create index if not exists idx_projects_site_id
  on public.projects (site_id);

create index if not exists idx_projects_created_by
  on public.projects (created_by);

-- warnings
create index if not exists idx_warnings_sender_id
  on public.warnings (sender_id);
