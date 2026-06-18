# Local dev runbook

Clone the repo → green dev server in ~5 minutes.

## Prerequisites

- **Node.js 22+** (`nvm install 22` if needed).
- **pnpm**: project pins `pnpm@11.5.2` in `package.json` `packageManager` field. Use `corepack` (ships with Node 22) to get it without a manual install:

  ```bash
  corepack enable
  corepack prepare pnpm@11.5.2 --activate
  pnpm --version  # should print 11.5.2
  ```

- **git** for source control.
- (Optional now, required for **Wave B** GPX library work) **plantuml** + **java** to render `.puml` diagrams; install via Homebrew (`brew install plantuml`).

## First-time setup

```bash
git clone git@github.com:<owner>/run-map.git
cd run-map
pnpm install      # downloads ~340 packages, allows sharp + unrs-resolver builds
cp .env.example .env.local
```

Then edit `.env.local` and fill in the values (see [Environment variables](#environment-variables) below). With Yuki's existing Supabase project the easiest path is to ask Yuki to share the `NEXT_PUBLIC_*` keys directly.

## Run the dev server

```bash
pnpm dev
```

- Dev server uses **Turbopack** and binds to `http://localhost:3000`.
- Boot time is ~2–4 seconds.
- The placeholder routes (`/`, `/routes`, `/routes/example-route`, `/admin/login`, `/admin/upload`) all return 200 even with empty `.env.local` — the only thing requiring real env values is the map base layer (`NEXT_PUBLIC_PMTILES_URL`).

## Useful commands

```bash
pnpm typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm lint        # eslint . (next/core-web-vitals + next/typescript)
pnpm format      # prettier --write .
pnpm format:check
pnpm build       # production build
```

`pnpm test:e2e` activates in Wave C once Playwright fixtures land (task 8.3). `pnpm db:migrate` is live — see [Database migrations](#database-migrations) below.

## Local Supabase

You have two options for the Supabase backend during local development. Pick whichever matches your situation:

### Option A — Shared dev project (recommended for solo work)

Use Yuki's existing Supabase project. Ask Yuki to share the four values listed in [Environment variables](#environment-variables) and paste them into `.env.local`. Anonymous writes are rejected by RLS, so day-to-day reads against the dev project are safe.

Pros: zero setup, identical PostGIS + RLS as production.
Cons: writes you commit are visible to everyone with access; not suitable for destructive experiments.

### Option B — Supabase CLI emulator (recommended for migrations / RLS work)

When you need to iterate on schema or RLS policies, run a fully local Postgres + PostGIS + Auth stack via the Supabase CLI:

```bash
brew install supabase/tap/supabase    # one-time install
supabase init                         # only if supabase/ folder is absent
supabase start                        # boots Postgres + Studio + Auth on :54321 (~30s)
```

After `supabase start` finishes, it prints local API URL + anon key + service-role key. Copy them into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

Then enable PostGIS once (the emulator does not enable it by default):

```bash
supabase db reset           # if you want a clean state; otherwise skip
psql "postgresql://postgres:postgres@localhost:54321/postgres" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Stop the stack with `supabase stop` when you're done — it survives system reboots otherwise.

Pros: throwaway data, full control over schema state, no risk of polluting the shared project.
Cons: GitHub OAuth provider must be re-configured per emulator boot if you want to test the full sign-in flow; for pure schema work the service-role key is enough.

## Database migrations

`pnpm db:migrate` runs Drizzle migrations against whatever Supabase project the `.env.local` keys point at. The full local workflow is:

```bash
# 1. Edit lib/db/schema.ts (add/change columns, indexes, enums).
pnpm typecheck                              # confirm the TS shape compiles

# 2. Generate a migration SQL from the schema diff.
pnpm db:generate                            # writes lib/db/migrations/<timestamp>_<slug>.sql

# 3. Review the generated SQL by hand.
#    - confirm column types, NOT NULL constraints, default values
#    - confirm indexes (GIST for geometry, GIN for tags, btree for recorded_at)
#    - for RLS / GUC migrations: confirm policy expressions + ALTER DATABASE GUC line
#    NEVER apply a migration you have not eyeballed — Drizzle generators are best-effort.

# 4. Apply the migration to the configured Supabase project.
pnpm db:migrate                             # idempotent; re-runs replay the journal

# 5. Sanity-check the result in Supabase Studio (or the CLI emulator's Studio).
#    For RLS migrations, walk through the three queries in
#    docs/runbooks/deploy.md §7 "RLS sanity SQL".
```

If a migration is wrong, do **not** edit it in-place after applying — instead create a follow-up migration. Drizzle keeps a journal in `lib/db/migrations/meta/` that tracks which migrations have been applied, and rewriting history breaks that journal.

## Environment variables

Filled in `.env.local`. The full list is enumerated in [AGENTS.md](../../AGENTS.md#environment-variables) and `.env.example`. Quick start values:

| Var                             | First-time onboarding                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Ask Yuki, or create your own Supabase project for solo development                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above                                                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Same — never expose to client                                                                                         |
| `ADMIN_GITHUB_USERNAME`         | Your GitHub handle (for local admin testing)                                                                          |
| `NEXT_PUBLIC_PMTILES_URL`       | Use a public Protomaps demo first: `https://demo-bucket.protomaps.com/v4.pmtiles`; switch to Yuki's tile bundle later |

For local Postgres + Auth emulation see [Local Supabase → Option B](#option-b--supabase-cli-emulator-recommended-for-migrations--rls-work) above.

## Common gotchas

- **`pnpm install` fails on `sharp` or `unrs-resolver`**: pnpm 11+ requires explicit build-script approval. `pnpm-workspace.yaml` in repo root already lists them under `allowBuilds`; if you hit `[ERR_PNPM_IGNORED_BUILDS]`, double-check that file exists.
- **`pnpm dev` warns about multiple lockfiles**: usually from a `package-lock.json` in `$HOME` or a parent dir. The repo's `next.config.ts` sets `turbopack.root` to silence this, but if you see it, you can safely ignore.
- **TypeScript reports `Cannot find module '../../app/page.js'`**: stale `.next/types`. Run `rm -rf .next && pnpm typecheck`.
- **`pnpm dev` hot reload misses CSS changes**: kill + restart `pnpm dev` (Turbopack + CSS-in-CSS-vars sometimes desyncs).

## Where to go next

- [docs/architecture.md](../architecture.md) — system overview
- [docs/data-model.md](../data-model.md) — `routes` table and RLS
- [docs/runbooks/deploy.md](./deploy.md) — production deploy
- [docs/runbooks/pmtiles-update.md](./pmtiles-update.md) — base map refresh
- [AGENTS.md](../../AGENTS.md) — coding conventions, language policy, PR rules
- [CLAUDE.md](../../CLAUDE.md) — Claude Code entry point
