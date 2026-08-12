# المنظومات والمواقع (Al Itqan QA Testing)

Internal QA checklist module for platforms and websites (e.g. SOSS). Route: `/portal/testing`.

## Data model

```
companies (slug = itqan)
  └── qa_projects          # platform / site
        ├── qa_sections    # groups of items
        └── qa_test_items  # test | task + optional live result
              ├── qa_test_attachments  # screenshots (item | result scope)
              └── qa_test_attempts     # immutable history (on reset / change / clear)
```

### Enums

| Enum | Values |
|------|--------|
| `qa_project_status` | `active`, `done` |
| `qa_test_result` | `pass`, `bug`, `improve` |
| `qa_item_kind` | `test` (اختبار), `task` (مهمة) |
| `qa_test_severity` | `low`, `medium`, `high`, `critical` |
| `qa_attachment_scope` | `item` (task context), `result` (bug/improve evidence) |

### Screenshots (`qa_test_attachments`)

- Optional; up to **3** images per scope per item (`jpeg` / `png` / `webp`, max **5 MB** each).
- **`item` scope:** attach when creating/editing a **مهمة**. Stays on the item across reset/convert.
- **`result` scope:** attach when submitting **خلل** / **تحسين**. On archive, rows are stamped with `attempt_id` and shown in السجل.
- Stored privately in the `documents` bucket under `qa-testing/{project_id}/{item_id}/…`; upload via signed URL (admin client).

### Structured bug fields (on `qa_test_items`)

| Field | Required when |
|-------|----------------|
| `result_note` | `bug` or `improve` |
| `severity` | `bug` |
| `steps_to_reproduce` | `bug` |
| `expected_behavior` | optional (bug / improve) |

### Item lifecycle

1. Manager creates a **task** (dev work) or a **test** (ready for QA).
2. Interact users mark a task **جاهز للاختبار** via `mark_qa_task_ready_for_test` only (non-managers cannot flip `item_kind` with a direct UPDATE). That RPC archives any live result, then sets `task` → `test`.
3. Testers submit `pass` / `bug` / `improve` on `item_kind = test` only. Bugs require severity + steps to reproduce + note. Testers cannot overwrite an existing result — managers reset first (or change result, which archives automatically).
4. Managers can **reset** (`reset_qa_test_item`) or change/clear a live result; the previous result is always snapshotted into `qa_test_attempts` first. History is never deleted.
5. Managers can flip kind either way via the badge; if a live result exists it is archived first.

### Progress metrics

- Progress bar / `%` = **tested / total items** (tests **and** tasks). An item counts as tested when it has any submitted result.
- Chips: **نجاح** (pass count), **خلل/تحسين** (bug + improve), and **مهام** when taskCount > 0. Section headers and overview nav show `tested/total` and `· N خلل/تحسين` when open > 0.

Helpers: `computeQaProgress`, `partitionQaItems`, `recentOpenQaItems`, `recentCompletedQaItems` in [`lib/qa-testing-format.ts`](../lib/qa-testing-format.ts).

## Project detail UI (scale: 200+ items)

Route: `/portal/testing/[id]` — container `max-w-6xl`.

### Checklist (main column)

- Each section shows **actionable** items first: **tasks**, then tests by attention (**bug** → **improve** → untested). The add-item form opens under the section header.
- Only **`pass`** moves into the collapsed-by-default **مكتمل (N)** group (sorted by `tested_at` descending). Bug/improve stay in the main list until fixed and re-passed.
- Filters: الكل / غير مختبر / **خلل وتحسين** (bug|improve) / مهام. The Done group is only shown under «الكل».
- Focusing an item from the overview forces filter to **الكل** so the target is in the DOM.
- Default collapse is per section: the first two sections stay open; other sections with more than 12 items start collapsed (user can expand).
- Drag-and-drop reorders the main-list items only (managers, filter=الكل, no active search).
- Attempt history («السجل») is **lazy-loaded** via `getQaTestAttemptsAction` when opened — not nested in the initial detail query.

### Overview panel (left on desktop / «نظرة عامة» tab on mobile)

- Search across titles/descriptions (client-side).
- Section navigator with `tested/total` (+ open count when relevant).
- **خلل وتحسين** feed — up to ~20 bug/improve items, sorted by severity then `tested_at` desc.
- **مكتمل مؤخراً** — last ~20 **pass** items; empty copy: «لا عناصر ناجحة بعد».

Orchestrated by `QaProjectWorkspace` (desktop CSS grid + mobile tabs).

## Access model

Access is **per user** (`profiles.testing_access_enabled`), granted by a superadmin from `/portal/admin`. Not company-scoped.

| Capability | Superadmin | Manager\* with flag | Employee with flag | Owner with flag | No flag |
|------------|------------|---------------------|--------------------|-----------------|---------|
| View list / detail / stats / history | ✓ | ✓ | ✓ | ✓ | ✗ |
| Submit results / convert task→test | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create / edit / delete structure / reset | ✓ | ✓ | ✗ | ✗ | ✗ |

\*Manager = `md_admin` or `company_manager`.

### Security constraints (DB)

- `profiles_lock_privileged_columns` — only superadmins may change `testing_access_enabled` or `is_super_admin`.
- `qa_test_items_restrict_tester_update` — non-managers: no result overwrite; `tested_by` forced to `auth.uid()`; `created_at` locked; kind change only when RPC sets `app.qa_rpc_kind_change`.
- BEFORE UPDATE on items archives the live result whenever managers clear or change it (`_snapshot_qa_test_attempt`). Preferred UI path remains `reset_qa_test_item` (stamps `reset_by`).

Helpers in [`lib/itqan-testing.ts`](../lib/itqan-testing.ts):

- `hasTestingAccess` — may enter the module
- `canInteractWithTesting` — may mutate results / convert tasks (owners excluded)
- `canManageTesting` — may edit structure

RLS mirrors this: `current_has_testing_access`, `current_can_interact_testing`, `current_can_manage_testing`.

`qa_test_attempts` is select-only for users with testing access; inserts happen inside security-definer helpers / RPCs.

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/0063_qa_testing.sql` | Initial schema + RLS |
| `supabase/migrations/0065_qa_item_kind.sql` | `item_kind` |
| `supabase/migrations/0071_qa_testing_hardening.sql` | Drop `assigned_to`, interact helper, trigger fix |
| `supabase/migrations/0072_qa_testing_history_and_severity.sql` | Severity fields, attempts history, reset RPCs |
| `supabase/migrations/0073_qa_testing_security_hardening.sql` | Privilege column lock, tester trigger, archive-on-change |
| `supabase/migrations/0074_fix_archive_qa_row_count.sql` | Fix archive ROW_COUNT boolean bug |
| `supabase/migrations/0075_qa_test_screenshots.sql` | Attachments table + stamp on archive |
| `app/portal/testing/` | Pages + server actions |
| `app/portal/testing/screenshot-actions.ts` | Signed upload / view / delete |
| `components/testing/QaScreenshotGallery.tsx` | Thumbnail gallery + lightbox |
| `components/testing/QaProjectWorkspace.tsx` | Desktop grid + mobile tabs |
| `components/testing/QaTestingOverviewPanel.tsx` | Search / nav / open + recent feeds |
| `components/testing/QaSectionDoneGroup.tsx` | Per-section collapsed Done group |
| `components/testing/QaSectionsList.tsx` | Checklist + filters + DnD |
| `lib/itqan-testing.ts` | Access helpers + Itqan company id |
| `lib/qa-testing-format.ts` | Labels, validation, progress/partition/search helpers |
| `lib/qa-screenshots.ts` | Mime/size limits |
| `app/portal/admin/testing-access-toggle.tsx` | Superadmin grant UI |
