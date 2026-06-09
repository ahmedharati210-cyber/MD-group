# Deferred major upgrades

These upgrades were intentionally **not** applied during the June 2026 platform update. Each is a breaking change and should be tackled in a dedicated PR with full regression testing.

## Tailwind CSS 3 → 4

| | |
|---|---|
| **Current** | `tailwindcss@^3.4.x` |
| **Latest** | `4.3.0` |
| **Risk** | High — new config format, PostCSS plugin changes |
| **Files affected** | `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css` |
| **Before upgrading** | Read [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide); run the official codemod; verify RTL/Cairo font tokens and dark mode |

## lucide-react 0.x → 1.x

| | |
|---|---|
| **Current** | `lucide-react@0.556.0` |
| **Latest** | `1.17.0` |
| **Risk** | Medium — import paths and package structure changed in v1 |
| **Files affected** | 100+ components under `app/` and `components/` |
| **Before upgrading** | Grep all `lucide-react` imports; run build and spot-check portal navigation icons |

## TypeScript 5 → 6

| | |
|---|---|
| **Current** | `typescript@5.9.3` |
| **Latest** | `6.0.3` |
| **Risk** | Medium — stricter checks may surface across 143+ app files |
| **Before upgrading** | Run `tsc --noEmit` on a branch; fix new errors before merging |

## @supabase/ssr 0.10 → 0.12

| | |
|---|---|
| **Current** | `@supabase/ssr@0.10.3` (auto-bumped within `^0.10.2`) |
| **Latest** | `0.12.0` |
| **Risk** | Medium — cookie/session handling may differ |
| **Files affected** | `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `proxy.ts` |
| **Before upgrading** | Test login, logout, token refresh, and `/portal/*` auth gating end-to-end |

## Node 24 → 26

| | |
|---|---|
| **Current** | Node **24 LTS** (pinned via `.nvmrc` and `package.json` engines) |
| **Latest** | `26.x` (Current, not LTS until ~Oct 2026) |
| **Risk** | Low for now — premature |
| **Recommendation** | Stay on Node 24 LTS until v26 reaches Active LTS. See [Node.js releases](https://nodejs.org/en/about/previous-releases). |

## Upgrade order (suggested)

1. `@supabase/ssr` — smallest surface, highest security relevance
2. `lucide-react` — mechanical import fixes
3. `typescript` — fix types before Tailwind churn
4. `tailwindcss` — largest UI/config migration
5. Node 26 — only after LTS status
