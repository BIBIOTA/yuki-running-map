# CLAUDE.md

Claude Code entry point for **Yuki's Running Map** — Yuki 的個人跑步路線分享網站（Next.js 15 + Supabase + MapLibre + Protomaps）。

> **🛑 Read [AGENTS.md](./AGENTS.md) before editing.** It encodes the language policy, code-style rules, folder boundaries, testing strategy, and commit/PR conventions that the rest of this project assumes.

## Pointers

- **Project north star**: [openspec/project.md](./openspec/project.md)
- **Architecture overview**: [docs/architecture.md](./docs/architecture.md)
- **Data model**: [docs/data-model.md](./docs/data-model.md)
- **Local dev setup**: [docs/runbooks/local-dev.md](./docs/runbooks/local-dev.md)
- **Deploy runbook**: [docs/runbooks/deploy.md](./docs/runbooks/deploy.md)
- **PMTiles refresh**: [docs/runbooks/pmtiles-update.md](./docs/runbooks/pmtiles-update.md)
- **Conventions**: [AGENTS.md](./AGENTS.md)

## Common commands

| Command             | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`          | Start Next.js dev server (Turbopack) on http://localhost:3000           |
| `pnpm build`        | Production build                                                        |
| `pnpm typecheck`    | `tsc --noEmit`, strict + `noUncheckedIndexedAccess`                     |
| `pnpm lint`         | ESLint flat config (extends `next/core-web-vitals` + `next/typescript`) |
| `pnpm format`       | Prettier write                                                          |
| `pnpm format:check` | Prettier check (CI gate)                                                |
| `pnpm db:migrate`   | _Wave B_ — Drizzle migrations                                           |
| `pnpm test`         | _Wave B_ — Vitest                                                       |
| `pnpm test:e2e`     | _Wave C_ — Playwright smoke tests for 5 placeholder routes              |

The PMTiles base map needs `NEXT_PUBLIC_PMTILES_URL` set — see [docs/runbooks/pmtiles-update.md](./docs/runbooks/pmtiles-update.md) for the refresh playbook.

## Do not

- Do **not** introduce new dependencies without first asking. Adding a runtime dep affects the bundle; adding a dev dep affects every contributor's setup.
- Do **not** write a `README.md` from scratch or open new top-level Markdown files unless the user asks — there is an established docs layout (`CLAUDE.md`, `AGENTS.md`, `README.md`, `openspec/`, `docs/`).
- Do **not** edit `next-env.d.ts` (Next.js owns it).
- Do **not** commit anything inside `.env.local`, `.env*.local`, or `.next/`. They are git-ignored for a reason.
- Do **not** rewrite the V2 Trail Vintage design tokens in `app/globals.css` without going through `spec-driven-dev:updating-spec` — they were chosen after a 3-version Figma exploration ([decision record](./openspec/changes/bootstrap-yuki-running-map/designs/figma.md)).
- Do **not** import across feature folders (`features/<a>` from `features/<b>`). Use `lib/*` for shared code (see [AGENTS.md](./AGENTS.md#folder-boundaries)).
- Do **not** use `next dev` without Turbopack — the project is opted into Turbopack and the workspace root is pinned in `next.config.ts`.

## OpenSpec workflow

Every PR corresponds to one OpenSpec change under `openspec/changes/{change-id}/`. Changes go through the `spec-driven-dev:*` skill chain:

1. `brainstorming` → `design.md`
2. `writing-plans` → `tasks.md`
3. `writing-uml` and/or `writing-figma` (if applicable) → `diagrams/` and `designs/`
4. `writing-spec` → `proposal.md` + `specs/{capability}/spec.md` (validated by `openspec validate --strict`)
5. `subagent-driven-development` (SDD) or `test-driven-development` (TDD)
6. `verification-before-completion` → `verification-report.md`
7. `openspec archive {change-id}`
