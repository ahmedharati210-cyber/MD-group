-- Add per-role feature visibility overrides to companies.
-- Shape: {"company_manager": ["attendance", "timeline", ...], "employee": [...]}
-- null = each role sees all of the company's enabled_features (no extra restriction).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS role_features jsonb DEFAULT NULL;

COMMENT ON COLUMN public.companies.role_features IS
  'Per-role visible features. Keys: "company_manager", "employee". '
  'Null = role sees all of the company''s enabled_features. '
  'Array = only the listed features are shown in the sidebar for that role.';
