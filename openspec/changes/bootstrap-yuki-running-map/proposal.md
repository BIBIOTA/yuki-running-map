---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

## Why

Yuki's Running Map 是全新專案，目前 repo 內除了 `openspec/` 之外**沒有任何程式碼**。在任何功能頁面（路線列表、詳情、管理員登入、上傳）開始實作前，必須先把專案骨架立起來：

- Next.js 15 App Router 與 TS strict mode 的 monorepo 結構
- V2 Trail Vintage 設計系統落實（design.md §6 已記載最終色票與字型）
- Supabase 後端（Postgres + PostGIS、Storage、GitHub OAuth）provisioned 並有 RLS
- Admin route 守護 middleware 通的
- 5 個 placeholder routes 證明 SSR + auth + middleware + Storage signed URL 整個串得通
- 文件骨架（CLAUDE.md / AGENTS.md / docs/ / openspec/project.md）就位，這樣每個未來 PR 都能對應到一個 OpenSpec change
- CI（GitHub Actions + Vercel Preview）綠燈

少了任何一塊，後續 4 個功能頁的 change 都會卡在 onboarding 階段。

## What Changes

- **project-foundation**：scaffold Next.js 15 App Router + TS strict + pnpm；apply V2 Trail Vintage design tokens 到 Tailwind v4 `@theme`；安裝 shadcn primitives + Lucide icons；建立 `(public)` 與 `(admin)` route group 共用 layout；交付 placeholder Logo SVG + favicon。
- **data-and-auth-infrastructure**：provision Supabase 專案（啟用 PostGIS、建立 `gpx` Storage bucket）；設定 GitHub OAuth provider；用 Drizzle 定義 `routes` table（含 PostGIS geometry 欄位、enum、indexes）；套用 RLS policies 鎖定寫入為 admin only；建立 `lib/supabase` client helpers（browser / server / middleware 三變體）；實作 `lib/map`（PMTiles loader + MapLibre style）與 `lib/gpx`（parse / simplify / metadata）utility 函式庫；實作 `middleware.ts` 守 `(admin)/*`。
- **placeholder-pages**：交付 5 個 placeholder routes — `/`、`/routes`、`/routes/[slug]`、`/admin/login`（含可運作的 GitHub OAuth 按鈕）、`/admin/upload`（受 middleware 保護）。不實作真實功能邏輯，只證明整條 SSR + Auth + Middleware + Storage 路徑串通。
- **docs-and-ci-pipeline**：寫 `CLAUDE.md`、`AGENTS.md`、`README.md`、`openspec/project.md`、`docs/architecture.md`、`docs/data-model.md`、`docs/runbooks/{local-dev,deploy,pmtiles-update}.md`；建立 GitHub Actions workflow（lint + typecheck + test）；連結 Vercel Preview Deployment；交付 Playwright smoke tests 覆蓋 5 個 placeholder routes。

## Impact

- **Affected specs**：
  - `specs/project-foundation/`（新增 capability）
  - `specs/data-and-auth-infrastructure/`（新增 capability）
  - `specs/placeholder-pages/`（新增 capability）
  - `specs/docs-and-ci-pipeline/`（新增 capability）
- **Affected code**：整個 repo（初始 scaffold；無既有狀態被覆蓋）
- **Breaking changes**：無（首次建立，沒有先前 API/contract）
- **External services touched**：
  - Supabase（建立新專案、啟用 PostGIS extension、建立 storage bucket）
  - GitHub（建立 OAuth App）
  - Vercel（連結 project + 設定 env vars）
- **Risk**：Supabase + Vercel + GitHub OAuth 三方設定步驟必須以 runbook 文件化，否則重新 onboard 會踩雷。runbook 撰寫納入 `docs-and-ci-pipeline` capability 的 acceptance。

## Related Artifacts

### Design
- [design.md](./design.md) — 完整設計文件（含技術選型、資料模型、UI 設計系統 V2 Trail Vintage tokens）
- [tasks.md](./tasks.md) — 9 個 task group / 約 34 個 tasks 的分解

### Diagrams
- [Component: System Architecture](./diagrams/01-component-system-architecture.puml) — Vercel / Next.js / Supabase / Protomaps 邊界與 runtime 切分（PNG 預覽：`diagrams/01-component-system-architecture.png`）

### Figma Designs
- [Figma Designs (V2 Trail Vintage selected)](./designs/figma.md) — Yuki's Running Map · Design System file，三版 mockup 並陳並已選定 V2 為實作方向
