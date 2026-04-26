# Supabase setup

This folder holds SQL migrations for the MD Group platform database.

## First-time setup

1. Create a new project at [supabase.com](https://supabase.com).
2. In the **Project Settings → API** page, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (server-only!)
3. Put those into `.env.local` at the repo root (see `.env.example`).
4. Open the Supabase **SQL editor**, paste the contents of
   [`migrations/0001_init.sql`](./migrations/0001_init.sql), and run it.
5. Create the private storage bucket:
   - Go to **Storage** → **New bucket**.
   - Name: `documents`. Keep it **private**.
   - (Optional) `avatars` bucket, public.
6. Create the first MD Group admin user:
   - **Authentication → Users → Add user** (email + password).
   - Then in the **SQL editor**:
     ```sql
     update public.profiles
     set role = 'md_admin', full_name = 'Your Name', company_id = null
     where id = '<user-id-copied-from-the-auth-users-table>';
     ```
7. Assign company managers the same way, but set
   `role = 'company_manager'` and a `company_id`.

## Roles recap

| Role              | Sees                                                     |
| ----------------- | -------------------------------------------------------- |
| `md_admin`        | All 5 companies, all data                                |
| `company_manager` | Only rows where `company_id = <their company>`           |
| `employee`        | Their own profile / attendance / personal documents only |

All visibility is enforced at the database layer via RLS.
