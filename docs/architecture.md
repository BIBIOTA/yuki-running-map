# Architecture

Long-form architecture reference for **Yuki's Running Map**. Pulls from `openspec/changes/bootstrap-yuki-running-map/design.md` §3 and the [component diagram](../openspec/changes/bootstrap-yuki-running-map/diagrams/01-component-system-architecture.puml) (rendered PNG at the same path with `.png` suffix).

## Topology

```
┌──────────────────────────────────────────────────────────┐
│ Vercel (Edge + Node runtimes)                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Next.js 15 App Router                                │ │
│ │  ├─ (public) layout · Edge runtime + ISR             │ │
│ │  │   ├─ /            首頁 (Hero + 精選)              │ │
│ │  │   ├─ /routes      路線列表 (篩選/排序/地圖)        │ │
│ │  │   └─ /routes/[slug]  路線詳情 (地圖 + GPX)         │ │
│ │  └─ (admin) layout · Node runtime · middleware-gated │ │
│ │      ├─ /admin/login                                 │ │
│ │      └─ /admin/upload                                │ │
│ │                                                      │ │
│ │  middleware.ts · Edge  (admin guard)                 │ │
│ │  Server Actions · Node  (GPX 解析 + 寫入)            │ │
│ │  Client Components       (MapLibre 互動)             │ │
│ └──────────────────────────────────────────────────────┘ │
└───────────────┬──────────────────┬───────────────────────┘
                │                  │
        Server Action /     fetch tiles
        Route Handler              │
                │                  ▼
                ▼           ┌──────────────┐
        ┌──────────────┐    │ Protomaps    │
        │   Supabase   │    │ PMTiles      │
        │  ├ Postgres  │    │ (Storage)    │
        │  │  +PostGIS │    └──────────────┘
        │  ├ Storage   │ ← GPX 原檔 + tiles bucket
        │  └ Auth      │ ← GitHub OAuth
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ GitHub OAuth │ (external IdP)
        └──────────────┘
```

For an authoritative, version-controlled view, see [diagrams/01-component-system-architecture.puml](../openspec/changes/bootstrap-yuki-running-map/diagrams/01-component-system-architecture.puml). Render with `plantuml -tpng <path>` or open the committed `.png` next to it.

## Boundaries

### Runtime split (Edge vs Node)

| Surface                                               | Runtime  | Why                                                                 |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `(public)/*` routes                                   | Edge     | Read-only, low-latency; SSR + ISR (revalidate 5 min) friendly       |
| `middleware.ts` (admin guard)                         | Edge     | Runs on every `(admin)/*` request; needs to be fast                 |
| `(admin)/*` routes                                    | Node     | UI shell — could be Edge but kept Node-side to match Server Actions |
| **Server Actions** (`'use server'`) — esp. GPX upload | **Node** | GPX parsing uses Node `Buffer` + streams; not available on Edge     |
| Client Components (MapLibre interactions)             | Browser  | MapLibre touches `window`/`document`                                |

### Trust boundaries

| Boundary                           | Trust on which side?          | Validation point                                                               |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Client → Server Action             | **don't trust** client        | Re-parse GPX on server (`lib/gpx`), validate file size, MIME                   |
| Anonymous → DB                     | **don't trust**               | Postgres RLS: anon SELECT is filtered to `published=true`, all writes rejected |
| Authenticated user → admin surface | **don't trust** session alone | middleware enforces `user.user_metadata.user_name === ADMIN_GITHUB_USERNAME`   |
| Server Action → Storage upload     | trusted (service-role key)    | Upload path normalised to `gpx/{yyyy}/{uuid}.gpx`                              |

### Folder boundaries (in-code)

Detailed in [AGENTS.md](../AGENTS.md#folder-boundaries). One sentence:

> Cross-feature imports are forbidden — `features/<A>` never imports from `features/<B>`. Shared code lives in `lib/*`.

## Visitor flow

1. Visitor requests `/routes`.
2. Edge route handler calls Drizzle `SELECT … WHERE published = true ORDER BY recorded_at DESC LIMIT 12` (with optional `ST_Intersects(bbox, ST_MakeEnvelope(...))` for map-mode).
3. SSR renders the list. `geojson` column (simplified line) is enough to draw thumbnails — no need to hit Storage.
4. Visitor clicks a route → `/routes/[slug]`.
5. Edge route handler `SELECT … WHERE slug = $1 LIMIT 1`.
6. SSR renders metadata + chips + map placeholder. MapLibre hydrates on the client, fetches PMTiles range requests directly from Supabase Storage.
7. "下載 GPX" button → request signed URL for the `gpx/<...>.gpx` object (24 h TTL).

## Admin upload flow

1. Yuki visits `/admin/upload`.
2. Edge middleware checks Supabase session cookie:
   - No session → redirect `/admin/login?from=/admin/upload`
   - Session but `user.user_metadata.user_name !== ADMIN_GITHUB_USERNAME` → sign out + redirect `?error=unauthorized`
   - OK → pass through
3. Yuki drag-drops a `.gpx` file. Client side parses it via `lib/gpx` for instant preview (visualisation only — not the trust boundary).
4. Yuki fills in title / description / region / tags / difficulty, toggles `published` and submits.
5. Server Action (Node runtime) **re-parses** the GPX (trust boundary), uploads original to `gpx/{yyyy}/{uuid}.gpx` Storage bucket, computes `bbox`, `start_point`, simplified `geojson`, and `INSERT`s into `routes`.
6. Server Action calls `revalidatePath('/routes')` + `revalidatePath('/routes/[slug]')`.

## Why Supabase one-stack?

Considered alternatives:

- **Neon + R2 + Auth.js**: best-of-breed but 3 separate accounts + signed URL plumbing on R2. Decided against in `design.md` §2.
- **Astro + Git workflow**: incompatible with the "admin upload page" requirement.

Supabase wins on ergonomics for a single-admin personal site: one dashboard for DB + Storage + Auth, PostGIS extension is one click, RLS is the natural place to express "anon read published only".

## See also

- [docs/data-model.md](./data-model.md) — `routes` schema, indexes, RLS policies, SQL examples
- [docs/runbooks/local-dev.md](./runbooks/local-dev.md) — clone → run
- [docs/runbooks/deploy.md](./runbooks/deploy.md) — production deploy + secrets
- [docs/runbooks/pmtiles-update.md](./runbooks/pmtiles-update.md) — base map refresh
- [AGENTS.md](../AGENTS.md) — conventions
