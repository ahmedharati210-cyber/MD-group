-- md_admin and owner are group-wide roles; they must not carry a fixed company_id.
-- The shell company is stored in the portal_active_company_id cookie instead.

update profiles
set company_id = null
where role in ('md_admin', 'owner')
  and company_id is not null;

alter table profiles
  add constraint profiles_admin_no_company_id
  check (role not in ('md_admin', 'owner') or company_id is null);
