# Attendance Module Audit — 2026-07-24

**Scope:** Full attendance & shifts module — business logic (shift matching, payroll, leave balances), calendar/day-panel UI/UX, Excel import/export, and branch/shift/settings access control. Includes the impact of the newly added per-company custom attendance month start day (`attendance_month_start_day`, 1–31).

**Trigger:** User reported that marking a day as leave/vacation fails with "لا يوجد استيراد لهذا الشهر" when the day belongs to a custom period's "prefix" days (e.g. day 28–31 of the previous calendar month, when the labeled month is the next one). That specific bug is tracked separately in [`fix_leave_record_month_lookup_31e8ed21.plan.md`](/Users/macbookpro/.cursor/plans/fix_leave_record_month_lookup_31e8ed21.plan.md); this document captures everything else found while auditing the surrounding module.

This is a companion to the earlier [`docs/attendance-audit.md`](docs/attendance-audit.md) (July 2026, PDF/manager-facing focus). This document covers the broader module after the leave-balance and custom-month-start features were added.

---

## How this was produced

Four parallel deep-dives, each read-only:

1. Shift matching, work-day resolution, period math, and payroll/leave-balance logic
2. Calendar, day panel, and record-editing UI/UX
3. Excel import parsing, re-import, and export (xlsx/PDF) generation
4. Branch/shift management, company settings, and access control

Findings below are deduplicated and merged across all four.

---

## Critical

### 1. Custom period boundaries overlap when `attendance_month_start_day` is 29–31
- **Where:** `lib/attendance/attendance-period.ts` — `resolveAttendancePeriod` (~L142–153), `clampDay` (~L83–85)
- **Issue:** The end of one labeled period and the start of the next are each clamped independently against the (potentially short) calendar month. When the previous month has fewer days than the configured start day (e.g. start day 31 and the previous month has 30 days, or any start day ≥ 29 near February), both clamp to the *same* calendar date. That date then belongs to two labeled periods simultaneously.
- **Impact:** A boundary day can be double-counted (present twice) or effectively double-charged for absence across two "months" in payroll/exports.
- **Tests:** `attendance-period.test.ts` only asserts single-period clamping ("clamps safely around February"); no test asserts adjacent periods are disjoint.

### 2. Overnight punch sessions split when checkout is ≥ 06:00 the next day
- **Where:** `lib/attendance/punch-sessions.ts` — `ATTENDANCE_DAY_START_MINUTES` (~L19–20), `attendanceDateForPunch` (~L46–55), `clusterIntoSessions` (~L89–120), `mergeSessionsBySameDay` (~L137–155)
- **Issue:** A punch's "attendance date" is decided using a fixed day-start cutoff. A check-in at 22:00 and checkout at 06:00–07:00 the next calendar day land on two different `shiftDate`s and are never merged back into one overnight session.
- **Impact:** Overnight shifts with a late checkout show as two broken one-punch days instead of one real shift — wrong present/late/deduction counts.
- **Tests:** **None.** There is no `punch-sessions.test.ts` at all — this is the single largest test coverage gap found.

### 3. Overnight late-minutes calculation never wraps past midnight
- **Where:** `lib/attendance/shift-matching.ts` — `computeLateMinutesForFullTime` (~L40–50), `computeDayRecordWithShift` (~L208–211), `computeOnePunchRecord` (~L136–141); same pattern in `lib/attendance/monthly-calculations.ts` (~L163–189)
- **Issue:** Late minutes = `checkIn - startExpected - grace`, with no +24h correction when the check-in time is numerically *before* the shift start because it's past midnight.
- **Impact:** For a 22:00 shift, checking in at 00:30 computes as 0 minutes late instead of ~2.5 hours late. Any overnight shift or custom overnight schedule under-reports lateness.
- **Tests:** Not covered — existing overnight tests only check shift *duration* math, not lateness.

### 4. Leave/absence creation resolves the wrong import month for custom-period "prefix" days
- **Where:** `app/portal/attendance/actions.ts:~1028` (`createLeaveRecordAction`), called from `AttendanceCreateLeaveForm` / `AttendanceCreateLeaveTableRow` / `AttendanceCreateLeaveMobileCard` in `attendance-record-edit-row.tsx`, wired from `attendance-day-panel.tsx` and `attendance-person-month-table.tsx`.
- **Issue:** `const month = \`${date.slice(0, 7)}-01\`` uses the raw calendar month of the date instead of resolving which *labeled* period the date belongs to.
- **Impact:** With `attendance_month_start_day = 28` and labeled period `2026-06` = `2026-05-28`…`2026-06-27`, marking `2026-05-29` as leave looks up an import for `2026-05-01` (doesn't exist) instead of `2026-06-01` → "لا يوجد استيراد لهذا الشهر" error, or attaches to the wrong import if one happens to exist.
- **Status:** Already scoped for a fix in a separate plan (see top of this doc). No `date → labeled month` helper currently exists in `attendance-period.ts` — only `month → period`.

### 5. Re-import / delete-import wipes leave days without restoring leave balances
- **Where:** `app/portal/attendance/actions.ts` — reimport wipe (~L408–414), `deleteAttendanceImportAction` (~L1498–1499). Contrast with single-record delete, which correctly calls `applyPersonLeaveBalanceDelta` (~L1542–1548).
- **Issue:** Bulk-deleting `attendance_monthly_records` by `import_id` removes annual/sick leave rows but never restores the corresponding leave balance.
- **Impact:** Reimporting a month or deleting an import permanently consumes an employee's leave entitlement for any leave days that existed in that import.

### 6. Import's dominant-month / "switch month" suggestion uses calendar month, not the labeled period
- **Where:** `lib/attendance/import-month.ts` — `detectDominantMonthFromDates` (~L48–65), used by the mismatch UI in `attendance-import-form.tsx`
- **Issue:** Counts `date.slice(0, 7)` (calendar month) to guess which month a file belongs to. The separate `detectImportMonthMismatch` correctly checks against the resolved period, but the "detected month" / "switch to this month" suggestion shown to the user is still calendar-based.
- **Impact:** With a custom start day, the suggested "correct" month in the mismatch warning can be wrong, misleading the admin during import.

---

## High

7. **Overnight early-leave math fails for overnight expected ends** — `lib/attendance/shift-matching.ts` (~L216–233), `lib/attendance/person-schedule.ts` (~L35–66). Early leave vs. a same-evening checkout can compute as 0 instead of a large early-leave value when `crosses_midnight` is false but the expected end is after midnight.
8. **Fallback `computeDayRecord` (no matched shift) breaks on overnight clock times** — `lib/attendance/monthly-calculations.ts:~193-198`. Used when no shift matches; can produce bogus large early-leave/deduction values for overnight unmatched sessions.
9. **Leave-balance updates aren't transactional with the record write** — `applyPersonLeaveBalanceDelta` in `actions.ts` (~L137–180) plus its call sites. Record write commits first; balance update is a separate read-modify-write with no optimistic lock — concurrent edits can lose updates, and a failed balance update after a successful leave write leaves the two out of sync.
10. **Force-deleting a person / bulk record deletes skip leave-balance restoration** — same root cause as #5 (`actions.ts:~1600-1604`).
11. **Reimport-diff reads a non-existent `manually_overridden` DB column** — `actions.ts:~250-260`, `import-reimport-diff.ts`. The override flag actually lives in `raw_payload`; selecting it as a column likely fails silently, so the "you're about to overwrite manual edits" warning never fires in production.
12. **Import saves rows outside the resolved period without filtering** — `import-process.ts:~85-96`. Mismatch detection only warns (at >50% out-of-period); rows are still inserted under the selected label regardless, so out-of-period dates get invisibly stored and can still affect summary totals (see #24 below).
13. **Import save is a non-atomic delete-then-insert** — `actions.ts:~408-476`. No DB transaction/RPC; a failed insert after the delete step loses the whole month; large files are inserted in a single unchunked call.
14. **Excel check-out/total column fallback can read the wrong cell** — `raw-excel-parser.ts:~219-227`. When a mapped cell is empty, the fallback reads a neighboring column (e.g. the weekday-name column) as if it were a time value.
15. **Excel date parsing mixes local and UTC getters** — `raw-excel-parser.ts:~81-87`, `raw-punch-log-parser.ts:~59-66`. The `Date`-object path uses local getters while the serial-number path uses UTC; can shift dates by one day depending on server timezone.
16. **Reimport diff doesn't flag removed leave/holiday days as "at risk"** — `import-reimport-diff.ts:~56-78`. Only flags punch-value *changes*; days present in DB but missing from the new file (e.g. manually marked leave) are silently overwritten without warning.
17. **Day panel rows don't remount after save** — stale `useState`/`defaultValue` — `attendance-day-panel.tsx`, `attendance-record-edit-row.tsx`. Can show data that disagrees with the server until a full page navigation, especially for status/waive fields.
18. **Delete failures are silent** — `delete-confirm-button.tsx:~34-41`. No toast/inline error on failure; confirm dialog just closes with no visible feedback.
19. **Out-of-period `?day=` query param opens the day panel with no validity check** — no `isDateInAttendancePeriod` guard in `page.tsx` / `attendance-overview-section.tsx`; bookmarks or hand-edited URLs can reference a day outside the current period with no calendar cell highlighted.
20. **Mobile calendar hides late-count and missing-punch badges** — `attendance-calendar.tsx` (`hidden sm:block` ~L202-207, legend `hidden sm:flex` ~L111). Phone users can't see تأخير / بصمة ناقصة counts at a glance.
21. **Person detail subtitle is wrapped in `dir="ltr"`** — `attendance-person-detail.tsx:~41-44`. Renders Arabic text backwards-feeling in an otherwise RTL app.
22. **Changing `attendance_month_start_day` silently reinterprets every existing import/record** — `updateCompanyAttendanceMonthStartAction` (`actions.ts:~1312-1348`). No warning, no list of affected imports, no historical snapshot of what start day was in effect when older data was imported.
23. **Branch delete has a TOCTOU race** — `actions.ts:~1648-1667`. Count people/imports, then delete; data added between the count and the confirm click is silently cascade-deleted with no re-check.

---

## Medium

- **Payroll/stats inconsistency:** `buildMonthSummary` (`attendance-view.ts:~59-66`) sums deduction minutes from *all* imported rows (including one-punch and out-of-period rows), while day-count stats elsewhere use period-filtered days only — overview cards can disagree with person/payroll totals.
- **`getDefaultAttendanceMonth` ignores custom start day** — `import-month.ts:~30-37`. Always assumes "previous calendar month"; with a custom start day the currently-open period is often a different label.
- **Export header label shows calendar month name, not the period range** — `attendance-report.ts:~148-157, ~335`. The daily grid itself correctly uses period days; only the printed title ("يونيو 2026") ignores the resolved `period.label`.
- **Employee-number matching is exact-string only** — `lib/data/monthly-attendance.ts:~205-207`, `raw-excel-parser.ts:~270-279`. No zero-pad/numeric normalization; `"123"` vs `"0123"` are treated as different people.
- **Full-time deduction adds late-minutes + shortfall-minutes** — `shift-matching.ts:~60-63`. Looks like double-counting for a late arrival with no make-up time; may be intentional payroll policy — worth confirming with whoever owns the deduction rules. Currently covered by tests as the expected behavior.
- **Empty work-day intersection across multiple active shifts silently means "nobody is ever absent"** — `person-schedule.ts:~186-199`. No validation warns about this misconfiguration.
- **`hasOnePunch` trusts a possibly-stale `punch_count` column** over the actual in/out pair — `calendar-shared.ts:~41-51`.
- **Shift CRUD has weak time validation** — `actions.ts` shift schemas (~L1674-1856). No HH:MM format enforcement, no start<end check when not crossing midnight, no overlap validation between shifts on the same branch/work-days.
- **Empty `work_days` allowed on shift save** — `actions.ts:~1699-1701`, `shift-manager.tsx:~245-262`. Related to the intersection issue above; no server-side rejection.
- **`assertAttendanceCompanyAccess` allows any `md_admin` to mutate branches/shifts/month-start for *any* company by ID**, while import actions correctly force the md_admin's own "shell" company via `resolveCompanyScope` — an inconsistency in scope enforcement (not a `company_manager` hole; that role is correctly blocked everywhere checked).
- **Branch delete confirmation undercounts blast radius** — only mentions people + imports; shifts and monthly records also cascade-delete but aren't mentioned in the warning.
- UI: rest/empty days default the create-leave form to "عطلة" (easy to accidentally grant a holiday on a rest day); the day-status column is labeled "إجازة" even though it controls full day status (present/absent/leave); day panel title shows raw ISO dates instead of an Arabic/period-aware label; desktop and mobile render two full parallel form trees per row (extra state, more surface for bugs); several accessibility gaps — unlabeled inputs in the desktop day panel, no `focus-visible` ring on calendar cells, filter controls without labels.

---

## Low

- Arabic wording inconsistencies: "ايام" vs "أيام", "بصمة واحدة" vs "بصمة ناقصة" for the same concept in different views.
- Inconsistent pending-button copy ("...", "…", "جاري الحفظ...") across forms.
- `leave_balance_reset_at` is stored but never surfaced anywhere in the UI (no "last reset on X" context next to the balance/reset button).
- Sticky action columns in the person-month table use physical `left` positioning instead of a logical/RTL-aware property.
- `weekendDays` metric only counts explicit `عطلة` leave rows, not scheduled off-days from work-day config — can undercount rest days in that specific metric.
- `recordStatusLabel` / `hasLeave` disagree on how they treat `is_holiday` without a `leave_type` set (legacy/partial rows can show inconsistent status).

---

## What's already solid

- Calendar/stats/payroll builders (`attendance-view.ts`, `attendance-report.ts`, `metric-drilldown.ts`) correctly thread `monthStartDay` through and use `resolveAttendancePeriod` throughout.
- Period-day math has solid unit test coverage for start days 1 and 28, including Friday-off and short-month (February) clamping.
- `company_manager` cross-company access is correctly blocked everywhere checked (page-level scoping, server action checks, and RLS all agree).
- The `CompanyMonthStartSettings` UI's permission gating (`md_admin` + `super_admin`) exactly matches its server action's `requireRole` check.
- Weekday-grid alignment in the calendar correctly uses the period's first day (not a hardcoded "day 1"), including the cross-month prefix indicator when a period spans two calendar months.
- Recalculate actions (`recalculatePersonMonthAction`, `recalculateBranchMonthAction`) already resolve date ranges via the period, unlike the leave-creation bug above.

---

## Suggested fix order

1. Finish the in-progress leave-record month-lookup fix (#4) — covers the reported bug.
2. Critical period/shift-matching bugs: boundary overlap (#1), overnight session splitting (#2), overnight late-minute wraparound (#3).
3. Leave-balance integrity on reimport/delete (#5, #10) — real data loss for employees.
4. Import period-consistency: dominant-month detection (#6), period-filtered saves (#12), reimport diff column bug (#11).
5. Remaining high-severity items, then medium/low as time allows — many are UI polish or validation hardening rather than active data corruption.

---

*Generated from a four-way parallel code audit on 2026-07-24. No fixes were applied as part of this audit; see the linked plan for the one bug currently being fixed.*
