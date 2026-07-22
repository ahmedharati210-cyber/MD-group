-- Add item_kind to distinguish اختبار vs مهمة on qa_test_items.

do $$ begin
  create type public.qa_item_kind as enum ('test', 'task');
exception when duplicate_object then null;
end $$;

alter table public.qa_test_items
  add column if not exists item_kind public.qa_item_kind not null default 'test';

comment on column public.qa_test_items.item_kind is
  'test = اختبار for QA; task = مهمة (shared checklist, no assignee).';

create index if not exists qa_test_items_kind_idx on public.qa_test_items(item_kind);
