-- Add project_id to engineer_reports and map_links so they can reference
-- projects directly (projects = sites in Emaar Al Youm).
-- The old site_id column is kept for backward compatibility but is no longer
-- used by the UI.

alter table public.engineer_reports
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.map_links
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists engineer_reports_project_idx on public.engineer_reports(project_id);
create index if not exists map_links_project_idx on public.map_links(project_id);
