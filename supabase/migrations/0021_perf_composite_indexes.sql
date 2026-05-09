-- Migration 0021: Add missing composite indexes for common query patterns.
--
-- The existing single-column indexes (profiles_role_idx, engineer_requests_requester_idx,
-- warnings_target_idx) help with equality filters but force a post-filter sort or second
-- lookup for range/sort columns. These composite indexes eliminate those extra steps.

-- ── employees list page ──────────────────────────────────────────────────────
-- Query: profiles WHERE role IN (...) ORDER BY created_at DESC LIMIT 50
-- Without composite: Postgres index-scans profiles_role_idx then sorts in memory.
-- With composite: index already delivers rows sorted by created_at — no sort step.
create index if not exists profiles_role_created_idx
  on public.profiles(role, created_at desc);

-- Query with company filter: profiles WHERE company_id = ? AND role IN (...)
-- Composite makes company+role filtering an index-only scan.
create index if not exists profiles_company_role_idx
  on public.profiles(company_id, role, created_at desc);

-- ── badge count queries (run on every portal layout load) ────────────────────
-- Query: engineer_requests WHERE requester_id = ? AND status = 'pending' COUNT(*)
-- Without composite: index scan on requester_id, then row-by-row status filter.
-- With composite: single index range scan returns only the matching status rows.
create index if not exists idx_engineer_requests_requester_status
  on public.engineer_requests(requester_id, status);

-- Query: warnings WHERE target_profile_id = ? AND is_read = false COUNT(*)
-- Without composite: index scan on target_profile_id, then is_read filter.
-- With composite: single scan returns only unread rows.
create index if not exists idx_warnings_target_is_read
  on public.warnings(target_profile_id, is_read);

-- ── profiles lookup in getCurrentUser ────────────────────────────────────────
-- The existing profiles(id) primary key is already optimal. No change needed.
