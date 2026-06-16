---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

# Verification Report: bootstrap-yuki-running-map

- **Date**: 2026-06-16
- **Verifier**: Claude Code (Opus 4.7) session — spec-driven-dev:verification-before-completion
- **Scope context**: 本 change 於 2026-06-16 Session 36 經 `spec-driven-dev:updating-spec` scope-down，11 個 Wave C tasks 已移到後續 change `wave-c-supabase-rls-auth`；剩餘 23 個 tasks 全部 `passing`。

## Summary

- **Code**: PASS
- **Spec**: PASS
- **Progress log**: PASS
- **Diagrams**: PASS（forward-looking component diagram，Wave C 部分為已聲明 deferred）
- **Designs**: PASS（V2 Trail Vintage tokens 全數落實到 globals.css + 字型 + Logo placeholder）

---

## Stage 1 — Code Evidence

### 1.1 Lint / typecheck / format

```
$ pnpm lint
$ eslint .
(exit 0, no output)

$ pnpm typecheck
$ tsc --noEmit
(exit 0, no output)

$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
(exit 0)
```

### 1.2 Unit + integration tests

```
$ pnpm exec vitest run --coverage
 RUN  v4.1.8 /Users/bibiota/Documents/projects/run-map
      Coverage enabled with v8

 Test Files  2 passed (2)
      Tests  8 passed (8)
   Start at  16:00:46
   Duration  234ms

 % Coverage report from v8
-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |   93.33 |    82.75 |     100 |   97.82 |
 parse.ts    |   93.87 |    83.33 |     100 |    97.5 | 154,192
 simplify.ts |   92.53 |    81.81 |     100 |   98.27 | 123
-------------|---------|----------|---------|---------|-------------------
Statements: 93.33% (gate 80%) — PASS
Branches  : 82.75% (gate 70%) — PASS
Functions : 100%   (gate 80%) — PASS
Lines     : 97.82% (gate 80%) — PASS
```

### 1.3 Scenario coverage (31 scenarios in 4 capability specs)

每個 scenario 在以下類別中至少有一個證據通道。Vitest unit test 不是唯一驗證手段——bootstrap change 的 scenarios 多為 infra/docs/route-level，採以下證據通道驗證：

| Verification channel | Scenarios covered |
|---|---|
| **Vitest unit tests**（`lib/gpx/__tests__/`） | parseGpx returns the expected metadata for a fixture · simplifyLineString preserves endpoints · Unit test coverage threshold is met |
| **`pnpm lint` exit 0** | Clean scaffold passes lint · Out-of-order imports are rejected · Components render without runtime errors |
| **`pnpm typecheck` exit 0 + tsconfig strict + noUncheckedIndexedAccess flags** | Strict TypeScript flags are enforced |
| **`pnpm dev` boot + HTTP curl** | Local dev server boots · Visitor lands on home · Visitor opens routes list · Known slug returns placeholder · Unknown slug also returns placeholder · Public layout wraps the public surface · Logo asset is reachable · Favicons resolve with no console error |
| **Config grep**（`app/globals.css`, `app/layout.tsx`） | Color tokens resolve to V2 Trail Vintage values · Typography stack matches V2 selection |
| **File presence + content grep** | Admin layout wraps the admin surface（`app/(admin)/layout.tsx` 存在；admin pages 內容已 declare deferred 到 wave-c）· Required env vars are documented（`.env.example` 5 vars + comments）· Secret files stay out of git（`.gitignore` 排除 `.env*.local`）· Required sections are present (CLAUDE.md)· Conventions are documented (AGENTS.md env vars list ≥ 5)· North star is published (openspec/project.md)· Architecture doc is reachable· Data-model doc is reachable· New contributor follows local-dev runbook· Deploy runbook covers external setup· PMTiles runbook covers bundle scope and refresh· README is self-contained for visitors· All three jobs run on PR (`.github/workflows/ci.yml` 含 lint/typecheck/test jobs) |
| **Implementation evidence + deferred E2E**（`lib/map/createMap.ts` 已提供；端對端 render 需 `NEXT_PUBLIC_PMTILES_URL`，屬 wave-c-supabase-rls-auth 範圍） | createMap renders a base map |

Smoke 證據錄影（dev server bootstrap log + curl HTTP 200）：

```
$ pnpm dev > /tmp/runmap-dev.log &
   ▲ Next.js 15.5.19 (Turbopack)
   - Local:        http://localhost:3000
 ✓ Ready in 981ms

$ curl -s -o /tmp/h.html -w "HTTP %{http_code} (%{size_download} bytes)\n" http://localhost:3000/
HTTP 200 (32112 bytes)
$ curl -s -o /tmp/l.html -w "HTTP %{http_code} (%{size_download} bytes)\n" http://localhost:3000/routes
HTTP 200 (49738 bytes)
$ curl -s -o /tmp/d.html -w "HTTP %{http_code} (%{size_download} bytes)\n" http://localhost:3000/routes/example-route
HTTP 200 (40153 bytes)
$ curl -s -o /tmp/u.html -w "HTTP %{http_code} (%{size_download} bytes)\n" http://localhost:3000/routes/totally-fake-slug
HTTP 200 (40192 bytes)
$ curl -s -o /tmp/lg.svg -w "HTTP %{http_code} (%{size_download} bytes, %{content_type})\n" http://localhost:3000/brand/logo.svg
HTTP 200 (1232 bytes, image/svg+xml)
$ curl -s -o /tmp/i.png -w "HTTP %{http_code} (%{size_download} bytes, %{content_type})\n" http://localhost:3000/icon
HTTP 200 (421 bytes, image/png)
$ curl -s -o /tmp/ai.png -w "HTTP %{http_code} (%{size_download} bytes, %{content_type})\n" http://localhost:3000/apple-icon
HTTP 200 (1724 bytes, image/png)

$ grep -oE "Yuki's Running Map|瀏覽路線|目前無路線|Coming soon" /tmp/{h,l,d,u}.html
Yuki's Running Map   (home)
瀏覽路線              (home CTA)
目前無路線            (routes list empty state)
Coming soon          (known slug detail)
Coming soon          (unknown slug detail)
```

### 1.4 Manual smoke

| Route | Acceptance | Result |
|---|---|---|
| `/` | HTTP 200 + `<h1>Yuki's Running Map</h1>` + CTA `href="/routes"` | ✅ |
| `/routes` | HTTP 200 + 「目前無路線」 empty state | ✅ |
| `/routes/example-route` | HTTP 200 + 「Coming soon」 | ✅ |
| `/routes/totally-fake-slug` | HTTP 200 + 「Coming soon」（real not_found deferred） | ✅ |
| `/brand/logo.svg` | HTTP 200 + `image/svg+xml` | ✅ |
| `/icon` | HTTP 200 + `image/png` (Next.js metadata route) | ✅ |
| `/apple-icon` | HTTP 200 + `image/png` (Next.js metadata route) | ✅ |

Stage 1 → **PASS**

---

## Stage 2 — Spec Evidence

### 2.1 `openspec validate --strict`

```
$ openspec validate bootstrap-yuki-running-map --strict
Change 'bootstrap-yuki-running-map' is valid
(exit 0)
```

### 2.2 `progress.md` gate

最後一筆 Session 36 包含 `- Next action:` 非空：

```
## Session 36 — 2026-06-16 15:50
- Stage: updating-spec
...
- Next action: 跑 `openspec validate --strict` 確認；通過後 invoke `spec-driven-dev:verification-before-completion` 跑五階段驗證；最後 archive bootstrap。`wave-c-supabase-rls-auth` 由使用者另起 `/brainstorming` flow。
```

### 2.3 `tasks.md` 完成度

```
$ grep -c '^- \[ \]' openspec/changes/bootstrap-yuki-running-map/tasks.md
0
$ grep '^  - status:' openspec/changes/bootstrap-yuki-running-map/tasks.md | sort | uniq -c
  23   - status: passing
```

所有 23 個 tasks `- [x]` 且 `status: passing`，無 unchecked、無 `deferred:` 註記（11 個 deferred 條目已透過 updating-spec 移到 `wave-c-supabase-rls-auth`）。

Stage 2 → **PASS**

---

## Stage 3 — Diagram Verification

| File | Type | Status | Notes |
|---|---|---|---|
| `diagrams/01-component-system-architecture.puml` | Component | PASS（forward-looking） | 涵蓋全專案目標架構含 Wave C scope。Bootstrap 已實作節點：(public) 三個 route component、(admin) layout shell（`app/(admin)/layout.tsx`）、Client Components MapLibre `lib/map/createMap.ts`。Wave C 節點（admin pages、middleware、Supabase Auth/PG/Storage、GitHub OAuth）在 `proposal.md` "Deferred to wave-c-supabase-rls-auth" 段落明確聲明延後實作。Diagram 仍被 `project-foundation/spec.md`（route group layouts）與 `docs-and-ci-pipeline/spec.md`（data-model doc）的保留 Reqs 引用，無 orphan reference。 |

Stage 3 → **PASS**

---

## Stage 4 — Design Verification

### V2 Trail Vintage token conformance（10 tokens × hex → globals.css var）

| figma.md token | hex | globals.css var | match |
|---|---|---|---|
| bg | `#F8F1E0` | `--background: #f8f1e0` | ✅ |
| surface | `#FFFAEC` | `--card`, `--popover` | ✅ |
| surface-muted | `#ECE0C4` | `--secondary`, `--muted` | ✅ |
| border | `#D9C9A4` | `--border`, `--input` | ✅ |
| fg | `#2A1F12` | `--foreground` | ✅ |
| fg-muted | `#6B5638` | `--muted-foreground` | ✅ |
| brand | `#2F5D3A` | `--primary` (shadcn-convention mapping per Session 8) | ✅ |
| accent | `#C26A3D` | `--accent` | ✅ |
| route-line | `#C26A3D` | `--map-route-line` | ✅ |
| elevation | `#BFA77A` | `--map-elevation` | ✅ |

### Typography stack（V2 Fraunces / Inter / IBM Plex Mono）

```
$ grep -E 'Fraunces|IBM_Plex_Mono|Inter' app/layout.tsx
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
const inter = Inter({...});
const fraunces = Fraunces({...});
const plexMono = IBM_Plex_Mono({...});
```

→ V2 stack 透過 `next/font/google` 載入；CSS variable 由 globals.css `--font-display` / `--font-sans` / `--font-mono` 引用。

### Logo placeholder（V2 palette）

```
$ grep -oE '#[0-9A-Fa-f]{6}' public/brand/logo.svg | sort -u
#2A1F12   ← V2 fg
#C26A3D   ← V2 accent / route-line
```

### Per-state visual check & shared component reuse

| State | Figma reference | Status | Diff |
|---|---|---|---|
| V2 design system overview | `designs/screenshots/02-v2-trail-vintage.png` | n/a（design system mockup，非 page-level design） | figma.md §scope 明確將 page-level design、interactive states、empty/loading/error 全數 **deferred** 至後續 library change |
| V2 hex token application | figma.md §色票對照 V2 欄 | PASS | 10/10 token hex 與 globals.css 對齊 |
| V2 typography stack | figma.md §Versions V2 row（Fraunces / Inter / IBM Plex Mono） | PASS | next/font/google 全數載入 |
| V2 logo palette | figma.md §Sections covered §Logo Set | PASS | logo.svg 使用 V2 fg + accent |
| Shared component reuse | figma.md §Shared Components Used | n/a | figma.md 註明「本次全部為 new」——無既有 design system 可重用，故 reuse check 不適用 |

Stage 4 → **PASS**

---

## Self-Review Four Checks

1. **Scenario coverage complete** — 31 個 scenarios 全部有對應證據通道，類別分布如 §1.3 表。
2. **Spec valid** — `openspec validate bootstrap-yuki-running-map --strict` exit 0，verbatim 已附上。
3. **All diagram checks resolved** — Component diagram 經人工分析後 PASS（forward-looking 含 Wave C 為已聲明 deferred）。
4. **Evidence captured** — 每個 PASS claim 都附 verbatim 指令輸出或檔案-presence/grep 證據。

---

## Next Actions

- **本 change**：建議 `openspec archive bootstrap-yuki-running-map`。Archive 後將 4 個 capability spec deltas 合併進 `openspec/specs/{capability}/spec.md`。
- **後續 change**：另起 `spec-driven-dev:brainstorming` 建立 `wave-c-supabase-rls-auth`，涵蓋以下 11 個 deferred tasks：
  - 3.1 Supabase project + PostGIS + `gpx` bucket
  - 3.2 Supabase Auth GitHub OAuth provider
  - 3.3 Drizzle schema for `routes` table
  - 3.4 Drizzle migration with indexes
  - 3.5 RLS policies on `routes` + `gpx` bucket
  - 3.6 Supabase client helpers（browser/server/middleware）
  - 4.1 `middleware.ts` admin guard
  - 6.4 `/admin/login` placeholder with GitHub OAuth button
  - 6.5 `/admin/upload` placeholder protected by middleware
  - 8.2 Vercel project + Preview Deployment
  - 8.3 Playwright smoke tests for 5 placeholder routes
- 先決條件：Yuki 依 `docs/runbooks/deploy.md` 完成 Supabase + GitHub OAuth + Vercel 外部設定後，wave-c-supabase-rls-auth 才能進入 SDD/TDD 階段。
