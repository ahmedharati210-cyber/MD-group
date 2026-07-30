# المنظومات والمواقع (Al Itqan QA Testing)

Internal QA checklist module for platforms and websites (e.g. SOSS). Route: `/portal/testing`.

## Data model

```
companies (slug = itqan)
  └── qa_projects          # platform / site
        ├── qa_sections    # groups of items
        └── qa_test_items  # test | task + optional live result
              └── qa_test_attempts  # immutable history (on reset / reopen)
```

### Enums

| Enum | Values |
|------|--------|
| `qa_project_status` | `active`, `done` |
| `qa_test_result` | `pass`, `bug`, `improve` |
| `qa_item_kind` | `test` (اختبار), `task` (مهمة) |
| `qa_test_severity` | `low`, `medium`, `high`, `critical` |

### Structured bug fields (on `qa_test_items`)

| Field | Required when |
|-------|----------------|
| `result_note` | `bug` or `improve` |
| `severity` | `bug` |
| `steps_to_reproduce` | `bug` |
| `expected_behavior` | optional (bug / improve) |

### Item lifecycle

1. Manager creates a **task** (dev work) or a **test** (ready for QA).
2. Anyone with interact access can mark a task **جاهز للاختبار** → converts `task` → `test` and archives/clears any stale result via `mark_qa_task_ready_for_test`.
3. Testers submit `pass` / `bug` / `improve`. Bugs require severity + steps to reproduce + note.
4. Only managers can **reset** a result (`reset_qa_test_item`) — the live result is archived into `qa_test_attempts` first, then cleared so the item can be re-tested. History is never deleted.
5. Managers can flip kind either way via the badge; if a live result exists it is archived first.

Progress `%` counts **tests only** — open tasks are shown separately and do not depress completion.

## Access model

Access is **per user** (`profiles.testing_access_enabled`), granted by a superadmin from `/portal/admin`. Not company-scoped.

| Capability | Superadmin | Manager\* with flag | Employee with flag | Owner with flag | No flag |
|------------|------------|---------------------|--------------------|-----------------|---------|
| View list / detail / stats / history | ✓ | ✓ | ✓ | ✓ | ✗ |
| Submit results / convert task→test | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create / edit / delete structure / reset | ✓ | ✓ | ✗ | ✗ | ✗ |

\*Manager = `md_admin` or `company_manager`.

Helpers in [`lib/itqan-testing.ts`](../lib/itqan-testing.ts):

- `hasTestingAccess` — may enter the module
- `canInteractWithTesting` — may mutate results / convert tasks (owners excluded)
- `canManageTesting` — may edit structure

Shared labels / validation in [`lib/qa-testing-format.ts`](../lib/qa-testing-format.ts).

RLS mirrors this: `current_has_testing_access`, `current_can_interact_testing`, `current_can_manage_testing`. Non-managers are further restricted by trigger `qa_test_items_restrict_tester_update` (structure locked; only `task`→`test` kind change allowed).

`qa_test_attempts` is select-only for users with testing access; inserts happen only inside security-definer RPCs.

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/0063_qa_testing.sql` | Initial schema + RLS |
| `supabase/migrations/0065_qa_item_kind.sql` | `item_kind` |
| `supabase/migrations/0071_qa_testing_hardening.sql` | Drop `assigned_to`, interact helper, trigger fix |
| `supabase/migrations/0072_qa_testing_history_and_severity.sql` | Severity fields, attempts history, reset RPCs |
| `app/portal/testing/` | Pages + server actions |
| `components/testing/` | UI (result panel, attempt history, …) |
| `lib/itqan-testing.ts` | Access helpers + Itqan company id |
| `lib/qa-testing-format.ts` | Severity labels + submit validation |
| `app/portal/admin/testing-access-toggle.tsx` | Superadmin grant UI |
