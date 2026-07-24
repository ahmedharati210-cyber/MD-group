# المنظومات والمواقع (Al Itqan QA Testing)

Internal QA checklist module for platforms and websites (e.g. SOSS). Route: `/portal/testing`.

## Data model

```
companies (slug = itqan)
  └── qa_projects          # platform / site
        ├── qa_sections    # groups of items
        └── qa_test_items  # test | task + optional result
```

### Enums

| Enum | Values |
|------|--------|
| `qa_project_status` | `active`, `done` |
| `qa_test_result` | `pass`, `bug`, `improve` |
| `qa_item_kind` | `test` (اختبار), `task` (مهمة) |

### Item lifecycle

1. Manager creates a **task** (dev work) or a **test** (ready for QA).
2. Anyone with interact access can mark a task **جاهز للاختبار** → converts `task` → `test` and clears any result.
3. Testers submit `pass` / `bug` / `improve` (note required for bug/improve).
4. Only managers can **reset** a result so the item can be re-tested.
5. Managers can flip kind either way via the badge.

Progress `%` counts **tests only** — open tasks are shown separately and do not depress completion.

## Access model

Access is **per user** (`profiles.testing_access_enabled`), granted by a superadmin from `/portal/admin`. Not company-scoped.

| Capability | Superadmin | Manager\* with flag | Employee with flag | Owner with flag | No flag |
|------------|------------|---------------------|--------------------|-----------------|---------|
| View list / detail / stats | ✓ | ✓ | ✓ | ✓ | ✗ |
| Submit results / convert task→test | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create / edit / delete structure | ✓ | ✓ | ✗ | ✗ | ✗ |

\*Manager = `md_admin` or `company_manager`.

Helpers in [`lib/itqan-testing.ts`](../lib/itqan-testing.ts):

- `hasTestingAccess` — may enter the module
- `canInteractWithTesting` — may mutate results / convert tasks (owners excluded)
- `canManageTesting` — may edit structure

RLS mirrors this: `current_has_testing_access`, `current_can_interact_testing`, `current_can_manage_testing`. Non-managers are further restricted by trigger `qa_test_items_restrict_tester_update` (structure locked; only `task`→`test` kind change allowed).

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/0063_qa_testing.sql` | Initial schema + RLS |
| `supabase/migrations/0065_qa_item_kind.sql` | `item_kind` |
| `supabase/migrations/0071_qa_testing_hardening.sql` | Drop `assigned_to`, interact helper, trigger fix |
| `app/portal/testing/` | Pages + server actions |
| `components/testing/` | UI |
| `lib/itqan-testing.ts` | Access helpers + Itqan company id |
| `app/portal/admin/testing-access-toggle.tsx` | Superadmin grant UI |
