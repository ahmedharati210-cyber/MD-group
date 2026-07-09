-- Enforce company/branch consistency and repair mismatched live rows.

-- Remove imports whose company disagrees with their branch (cascades monthly records).
delete from public.attendance_imports i
using public.attendance_branches b
where i.branch_id = b.id
  and i.company_id <> b.company_id;

-- Remove duplicate people on wrong company when a correct-company twin exists.
delete from public.attendance_people p
using public.attendance_branches b
where p.branch_id = b.id
  and p.company_id <> b.company_id
  and exists (
    select 1
    from public.attendance_people p2
    where p2.branch_id = p.branch_id
      and p2.external_employee_number = p.external_employee_number
      and p2.company_id = b.company_id
  );

-- Align any remaining people/records where company_id disagrees with branch.company_id
update public.attendance_people p
set company_id = b.company_id
from public.attendance_branches b
where p.branch_id = b.id
  and p.company_id <> b.company_id;

update public.attendance_monthly_records r
set company_id = b.company_id
from public.attendance_branches b
where r.branch_id = b.id
  and r.company_id <> b.company_id;

-- Blank names from raw import: keep external number as fallback label
update public.attendance_people
set full_name = concat('موظف ', external_employee_number)
where trim(coalesce(full_name, '')) = '';

-- Composite uniqueness for composite FK targets
create unique index if not exists attendance_branches_company_id_id_idx
  on public.attendance_branches (company_id, id);

create unique index if not exists attendance_people_company_branch_id_idx
  on public.attendance_people (company_id, branch_id, id);

-- Composite FKs: branch must belong to the same company
alter table public.attendance_imports
  drop constraint if exists attendance_imports_branch_company_fkey;

alter table public.attendance_imports
  add constraint attendance_imports_branch_company_fkey
  foreign key (company_id, branch_id)
  references public.attendance_branches (company_id, id)
  on delete cascade;

alter table public.attendance_people
  drop constraint if exists attendance_people_branch_company_fkey;

alter table public.attendance_people
  add constraint attendance_people_branch_company_fkey
  foreign key (company_id, branch_id)
  references public.attendance_branches (company_id, id)
  on delete cascade;

alter table public.attendance_monthly_records
  drop constraint if exists attendance_monthly_records_branch_company_fkey;

alter table public.attendance_monthly_records
  add constraint attendance_monthly_records_branch_company_fkey
  foreign key (company_id, branch_id)
  references public.attendance_branches (company_id, id)
  on delete cascade;

alter table public.attendance_monthly_records
  drop constraint if exists attendance_monthly_records_person_fkey;

alter table public.attendance_monthly_records
  add constraint attendance_monthly_records_person_fkey
  foreign key (company_id, branch_id, attendance_person_id)
  references public.attendance_people (company_id, branch_id, id)
  on delete set null;
