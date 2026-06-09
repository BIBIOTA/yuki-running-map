# Yuki's Running Map

> Yuki 的個人跑步路線分享地圖。Built with care, Built with [Next.js](https://nextjs.org), [Supabase](https://supabase.com), [MapLibre](https://maplibre.org), and [Protomaps](https://protomaps.com).

**Live**: _coming soon_ · **Owner**: Yuki ([BiBiOTA](https://github.com/BiBiOTA))

A read-only website that lets visitors browse Yuki's running routes — search by region or tag, drag the map to filter, open any route for a detailed view (map + elevation profile + GPX download). Admin (Yuki) signs in via GitHub OAuth to upload new routes.

## Tech stack

| Layer     | Choice                                                                  |
| --------- | ----------------------------------------------------------------------- |
| Framework | Next.js 15 (App Router) + React 19, deployed on Vercel                  |
| Database  | Supabase Postgres + PostGIS extension                                   |
| Storage   | Supabase Storage (`gpx` bucket + `tiles` bucket for PMTiles)            |
| Auth      | Supabase Auth · GitHub OAuth provider                                   |
| ORM       | Drizzle                                                                 |
| Map       | MapLibre GL JS + Protomaps PMTiles (self-hosted)                        |
| UI        | Tailwind CSS v4 + shadcn/ui primitives · V2 Trail Vintage design system |
| Tooling   | TypeScript strict · ESLint 9 flat config · Prettier 3 · pnpm 11         |

## Quickstart

```bash
corepack enable && corepack prepare pnpm@11.5.2 --activate
git clone git@github.com:<owner>/run-map.git && cd run-map
pnpm install
cp .env.example .env.local   # fill in Supabase + PMTiles URL
pnpm dev                     # http://localhost:3000
```

Full setup walkthrough: [docs/runbooks/local-dev.md](./docs/runbooks/local-dev.md).

## Project structure & conventions

- [CLAUDE.md](./CLAUDE.md) — Claude Code entry point + common commands
- [AGENTS.md](./AGENTS.md) — code-style rules, folder boundaries, PR conventions (**read before editing**)
- [docs/architecture.md](./docs/architecture.md) — runtime split, trust boundaries
- [docs/data-model.md](./docs/data-model.md) — `routes` schema, indexes, RLS
- [openspec/](./openspec) — every PR maps to one OpenSpec change

## License

This is a personal project. The code is shared for reference; the routes, photos, and writing belong to Yuki and are not re-licensed for redistribution.
