-- Rename seeded «company #2» (slug company-two) to الطريق الصحيح for Dolce / employee signup.

update public.companies
set
  name_ar = 'الطريق الصحيح',
  name_en = 'Al-Sirat'
where slug = 'company-two';
