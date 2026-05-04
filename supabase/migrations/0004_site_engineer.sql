-- =============================================================================
-- MD Group — Add default engineer assignment to sites
-- =============================================================================

alter table public.sites
  add column if not exists default_engineer_id uuid
    references public.profiles(id) on delete set null;

create index if not exists sites_default_engineer_idx
  on public.sites(default_engineer_id);
