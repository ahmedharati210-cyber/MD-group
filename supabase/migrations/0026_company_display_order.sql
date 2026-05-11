-- Portal company grid order: lower `display_order` appears first (1 = Emaar, 2 = الطريق الصحيح).

alter table public.companies
  add column if not exists display_order integer not null default 999;

comment on column public.companies.display_order is
  'Sort order on admin/public company listings (ascending). Defaults high so explicit rows (1, 2, …) float to the top.';

-- Stable #2: الطريق الصحيح / Dolce signup company
update public.companies
set display_order = 2
where slug = 'company-two';

-- #1: Emaar Al Youm — prefer English name match, else company with timeline feature (app convention)
update public.companies
set display_order = 1
where id = (
  select id
  from public.companies
  where
    name_en ilike 'Emaar%'
    or (
      enabled_features is not null
      and 'timeline' = any (enabled_features)
    )
  order by
    case when name_en ilike 'Emaar%' then 0 else 1 end,
    created_at
  limit 1
);

-- Remaining companies: 3, 4, 5, … by Arabic name
with ordered as (
  select
    id,
    row_number() over (order by name_ar) as rn
  from public.companies
  where display_order = 999
)
update public.companies c
set display_order = 2 + ordered.rn
from ordered
where c.id = ordered.id;
