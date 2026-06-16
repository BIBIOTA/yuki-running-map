---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

## Why

Yuki's Running Map 是全新專案，目前 repo 內除了 `openspec/` 之外**沒有任何程式碼**。在任何功能頁面開始實作前，必須先把「不被外部服務阻塞」的專案骨架立起來：

- Next.js 15 App Router 與 TS strict mode 的 monorepo 結構
- V2 Trail Vintage 設計系統落實（design.md §6 已記載最終色票與字型）
- `lib/map`（PMTiles + MapLibre）與 `lib/gpx`（parse + simplify + metadata）utility 函式庫
- 3 個 public placeholder routes（`/`、`/routes`、`/routes/[slug]`）證明 SSR + route group layout 通的
- 文件骨架（CLAUDE.md / AGENTS.md / docs/ / openspec/project.md）就位，這樣每個未來 PR 都能對應到一個 OpenSpec change
- GitHub Actions CI（lint + typecheck + test）綠燈

少了任何一塊，後續 change 都會卡在 onboarding 階段。

> **Scope narrowed mid-implementation (2026-06-16)**: 原計畫包含 Supabase 後端 provisioning、GitHub OAuth、Drizzle schema/migration/RLS、Supabase client helpers、admin middleware、admin 兩個 placeholder pages、Vercel Preview Deployment、Playwright smoke tests。這些 tasks transitively 依賴 Yuki 完成 `docs/runbooks/deploy.md` 描述的外部服務設定，無法在本 change 內完成。經使用者決策，全部移到後續 change `wave-c-supabase-rls-auth`（待創）。Bootstrap 以「不被外部服務阻塞」的進度收尾 archive，使 main 分支隨時可獨立 deploy 與 develop。詳見 `progress.md` Session 36。

## What Changes

- **project-foundation**：scaffold Next.js 15 App Router + TS strict + pnpm；apply V2 Trail Vintage design tokens 到 Tailwind v4 `@theme`；安裝 shadcn primitives + Lucide icons；建立 `(public)` 與 `(admin)` route group 共用 layout；交付 placeholder Logo SVG + favicon。
- **data-and-auth-infrastructure**（scope 縮減）：實作 `lib/map`（PMTiles loader + MapLibre style）與 `lib/gpx`（parse / simplify / metadata）utility 函式庫。Supabase provisioning、OAuth、Drizzle schema、RLS、client helpers、middleware 全部延後到 `wave-c-supabase-rls-auth`。
- **placeholder-pages**（scope 縮減）：交付 3 個 public placeholder routes — `/`、`/routes`、`/routes/[slug]`。Admin login / upload 兩個 placeholder pages 延後到 `wave-c-supabase-rls-auth`。
- **docs-and-ci-pipeline**（scope 縮減）：寫 `CLAUDE.md`、`AGENTS.md`、`README.md`、`openspec/project.md`、`docs/architecture.md`、`docs/data-model.md`、`docs/runbooks/{local-dev,deploy,pmtiles-update}.md`；建立 GitHub Actions workflow（lint + typecheck + test）。Vercel Preview Deployment 與 Playwright smoke tests 延後到 `wave-c-supabase-rls-auth`。

## Impact

- **Affected specs**：
  - `specs/project-foundation/`（新增 capability）
  - `specs/data-and-auth-infrastructure/`（新增 capability — 縮減至 Map + GPX libraries）
  - `specs/placeholder-pages/`（新增 capability — 縮減至 3 個 public routes）
  - `specs/docs-and-ci-pipeline/`（新增 capability — 縮減至 docs + GH Actions）
- **Affected code**：整個 repo（初始 scaffold；無既有狀態被覆蓋）
- **Breaking changes**：無（首次建立，沒有先前 API/contract）
- **External services touched**：
  - 無（runbook 已寫但實際 provisioning 由 `wave-c-supabase-rls-auth` 負責）
- **Deferred to `wave-c-supabase-rls-auth`**：
  - Supabase 專案 + PostGIS + `gpx` Storage bucket（原 task 3.1）
  - Supabase Auth GitHub OAuth provider（原 task 3.2）
  - Drizzle schema + indexes + migrations（原 tasks 3.3、3.4）
  - Routes table + Storage RLS policies（原 task 3.5）
  - Supabase client helpers（原 task 3.6）
  - Admin middleware（原 task 4.1）
  - `/admin/login` + `/admin/upload` placeholder pages（原 tasks 6.4、6.5）
  - Vercel project + Preview Deployment（原 task 8.2）
  - Playwright smoke tests for 5 placeholder routes（原 task 8.3）
- **Risk**：runbook 已寫但尚未 dry-run。當 Yuki 跑 `docs/runbooks/deploy.md` 流程時若發現缺步驟，`wave-c-supabase-rls-auth` 必須先修 runbook。

## Related Artifacts

### Design
- [design.md](./design.md) — 完整設計文件（含技術選型、資料模型、UI 設計系統 V2 Trail Vintage tokens）。注意：design.md 仍保留 Wave C 部分的設計，因為這些設計仍然有效，只是執行延後到 `wave-c-supabase-rls-auth`。
- [tasks.md](./tasks.md) — 縮減後的 7 個 task group / 23 個 tasks，全部 `passing`

### Diagrams
- [Component: System Architecture](./diagrams/01-component-system-architecture.puml) — Vercel / Next.js / Supabase / Protomaps 邊界與 runtime 切分（PNG 預覽：`diagrams/01-component-system-architecture.png`）

### Figma Designs
- [Figma Designs (V2 Trail Vintage selected)](./designs/figma.md) — Yuki's Running Map · Design System file，三版 mockup 並陳並已選定 V2 為實作方向
