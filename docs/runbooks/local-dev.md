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

`pnpm db:migrate` and `pnpm test` / `pnpm test:e2e` activate in Waves B / C.

## Environment variables

Filled in `.env.local`. The full list is enumerated in [AGENTS.md](../../AGENTS.md#environment-variables) and `.env.example`. Quick start values:

| Var                             | First-time onboarding                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Ask Yuki, or create your own Supabase project for solo development                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above                                                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Same — never expose to client                                                                                         |
| `ADMIN_GITHUB_USERNAME`         | Your GitHub handle (for local admin testing)                                                                          |
| `NEXT_PUBLIC_PMTILES_URL`       | Use a public Protomaps demo first: `https://demo-bucket.protomaps.com/v4.pmtiles`; switch to Yuki's tile bundle later |

For a quick local Supabase, you can run `supabase start` from the CLI (creates an emulator on `http://localhost:54321`). Wave B will add tooling for this; for now the production Supabase project is fine to point at since RLS rejects anon writes.

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
