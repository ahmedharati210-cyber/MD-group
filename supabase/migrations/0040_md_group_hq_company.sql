-- MD Group as a first-class company so HQ / central staff can be assigned a company_id
-- (subsidiaries already existed; the holding entity was missing from portal selects).

insert into public.companies (name_ar, name_en, slug, display_order, active)
values (
  'مجموعة MD Group',
  'MD Group',
  'md-group',
  0,
  true
)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  active = excluded.active,
  display_order = excluded.display_order;
