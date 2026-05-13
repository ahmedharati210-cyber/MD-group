-- Private per-user project draft notes (md_admin + superadmin oversight).
-- Visibility: author only, or any superadmin (SELECT/DELETE). Updates: author only.
-- Category/project pairing: enforced with a trigger (PG disallows subqueries in CHECK).

create table if not exists public.project_personal_drafts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.project_categories(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.validate_project_personal_drafts_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null then
    if not exists (
      select 1
      from public.project_categories pc
      where pc.id = new.category_id
        and pc.project_id = new.project_id
    ) then
      raise exception 'category must belong to project'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_personal_drafts_validate_category on public.project_personal_drafts;
create trigger project_personal_drafts_validate_category
  before insert or update on public.project_personal_drafts
  for each row
  execute function public.validate_project_personal_drafts_category();

create index if not exists project_personal_drafts_author_created_idx
  on public.project_personal_drafts (author_id, created_at desc);

create index if not exists project_personal_drafts_project_idx
  on public.project_personal_drafts (project_id);

create or replace function public.touch_project_personal_drafts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists project_personal_drafts_touch_updated_at on public.project_personal_drafts;
create trigger project_personal_drafts_touch_updated_at
  before update on public.project_personal_drafts
  for each row
  execute function public.touch_project_personal_drafts_updated_at();

alter table public.project_personal_drafts enable row level security;

-- Author or superadmin can read any draft (superadmin oversight).
create policy project_personal_drafts_select
  on public.project_personal_drafts
  for select
  using (
    author_id = (select auth.uid())
    or public.current_is_super_admin()
  );

-- Only md_group managers or superadmin may create rows; must label self as author.
create policy project_personal_drafts_insert
  on public.project_personal_drafts
  for insert
  with check (
    author_id = (select auth.uid())
    and (
      public.current_role() = 'md_admin'::public.user_role
      or public.current_is_super_admin()
    )
  );

-- Only the author may update (superadmin cannot rewrite another user's note body).
create policy project_personal_drafts_update
  on public.project_personal_drafts
  for update
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and author_id = (select auth.uid())
  );

-- Author deletes own; superadmin may delete any row (moderation).
create policy project_personal_drafts_delete
  on public.project_personal_drafts
  for delete
  using (
    author_id = (select auth.uid())
    or public.current_is_super_admin()
  );
