-- Portal notifications: distinguish warnings (red badge) vs notifications (orange badge).

alter table public.warnings
  add column if not exists kind text not null default 'warning';

alter table public.warnings
  drop constraint if exists warnings_kind_check;

alter table public.warnings
  add constraint warnings_kind_check check (kind in ('warning', 'notification'));
