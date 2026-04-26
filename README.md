# MD Group — Internal Platform

منصة إدارة داخلية لمجموعة MD تجمع خمس شركات تحت مظلة واحدة، مع صلاحيات متعددة
المستويات ومنظومة موحّدة للحضور والأوراق الرسمية والمراسلات.

## Tech stack

- **Next.js 16** (App Router, RSC, Server Actions, Route Handlers)
- **Tailwind CSS** + `lucide-react` + `react-hot-toast`
- **Supabase** for Auth, Postgres (with RLS), and Storage (PDFs / letters)
- **TypeScript**, **Zod** for validation
- **pdf-parse** for extracting searchable text from uploaded PDFs

Hosted on **Vercel**. No separate backend server for v1.

## Roles

| Role              | Visibility                                        |
| ----------------- | ------------------------------------------------- |
| `md_admin`        | All 5 companies + all data                        |
| `company_manager` | Only rows belonging to their single `company_id`  |
| `employee`        | Own profile, own attendance, own personal papers  |

All restrictions are enforced at the database level via Postgres **RLS**.

## Feature map

- `/` — public landing page (5 company cards, CTA to login)
- `/about`, `/contact` — public brand pages
- `/login` — Supabase email + password
- `/portal` — role-aware dashboard
- `/portal/companies` — company list + detail
- `/portal/employees` — CRUD for employees (+ managers for admins)
- `/portal/attendance` — check-in / check-out (employee), daily grid + CSV export (manager/admin)
- `/portal/papers` — upload PDFs/images, full-text search inside content, signed-URL preview
- `/portal/mail` — inbound/outbound mail log with document attachments
- `/portal/contacts` — contacts directory
- `/portal/settings` — edit own profile

## Setup

### 1. Install deps

```bash
npm install --legacy-peer-deps
```

### 2. Create a Supabase project

- Sign up at [supabase.com](https://supabase.com).
- In **Settings → API**, copy `Project URL`, `anon key`, and `service_role key`.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run the migration

Open the Supabase **SQL editor** and run the contents of
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

This creates:

- `companies`, `profiles`, `attendance`, `documents`, `mail`, `contacts`, `audit_log`
- All enums + indexes + RLS policies
- 5 placeholder companies (rename them to your real company names)
- A trigger that auto-creates a `profiles` row on user signup

### 5. Create the documents storage bucket

**Storage → New bucket**, name `documents`, keep it **private**.
Signed URLs are generated server-side on demand with a 5-minute expiry.

### 6. Create the first admin user

1. **Authentication → Users → Add user** (email + password).
2. In the **SQL editor**:

   ```sql
   update public.profiles
     set role = 'md_admin', full_name = 'Your Name'
     where id = '<uuid-from-users-table>';
   ```

3. For each `company_manager`, repeat but set `role = 'company_manager'` and
   `company_id = <a company id>`.

### 7. Run locally

```bash
npm run dev
```

The middleware redirects unauthenticated users hitting `/portal/*` to `/login`.
Managers can create employees via `/portal/employees/new`; the app provisions
the auth user + profile row in one flow using the service-role key
(server-only).

## Deployment (Vercel)

1. Push to GitHub.
2. In Vercel, import the repo.
3. Add the four env vars under **Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Next.js.

## Notes for the future

- The platform will grow into an HR system. Suggested next steps:
  - Payroll + leave requests tables (same RLS shape)
  - Performance reviews
  - Bulk PDF ingestion via a small Express worker on Railway
- Supabase Storage has per-bucket size & bandwidth limits. Monitor usage in the
  Supabase dashboard. For heavy archives, consider moving to S3-backed buckets.
- Audit trail lives in `audit_log`; every sensitive create action writes a row
  via the admin client.

---

© MD Group. All rights reserved.
