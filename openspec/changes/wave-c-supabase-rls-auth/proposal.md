---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

## Why

`bootstrap-yuki-running-map`（archive 2026-06-16）刻意把 11 個依賴外部服務（Supabase / GitHub OAuth / Vercel）的 tasks 切出來，使 bootstrap 在「不被外部服務阻塞」的狀態下 ship。verification-report.md §Next Actions 直接點名這些 tasks 由 `wave-c-supabase-rls-auth` 承接，並把它們列為後續所有功能 change 的先決條件。

Wave C 完成後：

- admin 能以 GitHub OAuth 真實登入、middleware 真擋未授權者
- `routes` table、4 個 PostGIS / GIN / btree index、2 條 RLS policy 全部建好（雖然表初始 0 筆）
- Supabase Storage `gpx` bucket 含 4 條 RLS policy（published row 對外公開、未發佈鎖 admin）
- Vercel Preview Deployment 自動建立、Playwright 5 個 E2E spec 在 CI 跑綠
- 文件（`docs/data-model.md` / `docs/architecture.md` / `docs/runbooks/*` / `CLAUDE.md`）更新對齊新的 storage 策略與指令現役狀態

少了這層，後續 `feat-admin-gpx-upload`、`feat-route-detail-page`、`feat-route-list-query`、`feat-map-viewport-search` 全部無法落地。

## What Changes

- **data-and-auth-infrastructure** (ADDED Requirements)：Supabase 專案 + PostGIS + `gpx` Storage bucket 設置完成（task 3.1）；Supabase Auth GitHub OAuth provider 設置完成（task 3.2）；Drizzle schema for `routes` 對齊 `docs/data-model.md`（task 3.3）；Drizzle migration 含 4 個 indexes（task 3.4）；RLS policies on `routes` + `gpx` bucket（task 3.5）；`lib/supabase/` browser/server/middleware factories（task 3.6）；`middleware.ts` admin guard（task 4.1）。
- **placeholder-pages** (ADDED + MODIFIED Requirements)：ADDED — `/admin/login` 真實 GitHub OAuth button + 觸發 `signInWithOAuth`（task 6.4）、`/admin/upload` Coming soon placeholder + sign-out（受 middleware 保護，task 6.5）。MODIFIED — Home page placeholder 加上 `?auth_error=not_admin` flash toast handler（task 6.6）。
- **docs-and-ci-pipeline** (ADDED + MODIFIED Requirements)：ADDED — Vercel Preview Deployment（task 8.2）、Playwright E2E 套件涵蓋 5 個 critical routes（含 OAuth mock fixture，task 8.3）。MODIFIED — GitHub Actions workflow 增加 `e2e` job 在 lint/typecheck/test 之後（task 8.4，Fork PR 不觸發）。
- **Documentation alignment**（無 spec delta，純 implementation tasks 7.1–7.5）：更新 `docs/data-model.md` §RLS / §Storage RLS / §`gpx_path` 對齊新 public-URL 策略；`docs/architecture.md` 新增 middleware → Supabase mermaid；`docs/runbooks/deploy.md` 新增 OAuth callback 驗證 + RLS 手動測試 SQL；`docs/runbooks/local-dev.md` 新增 `pnpm db:migrate` 流程；`CLAUDE.md` 常用指令表將 `pnpm db:migrate` / `pnpm test:e2e` 從「Wave B/C」更新為現役。

## Impact

- **Affected specs**：
  - `specs/data-and-auth-infrastructure/`（ADDED 7 個 Requirements）
  - `specs/placeholder-pages/`（ADDED 2 個 + MODIFIED 1 個 Requirement）
  - `specs/docs-and-ci-pipeline/`（ADDED 2 個 + MODIFIED 1 個 Requirement）
- **Affected code**：
  - 新增：`lib/db/schema.ts`、`lib/db/postgis.ts`、`lib/db/migrations/`、`lib/supabase/{browser,server,middleware}.ts`、`middleware.ts`、`e2e/`（fixtures + 5 spec 檔）、`.github/workflows/ci.yml` 的 `e2e` job
  - 修改：`app/(admin)/login/page.tsx`、`app/(admin)/upload/page.tsx`、`app/(admin)/layout.tsx`、`app/(public)/page.tsx`（flash toast handler）、`docs/data-model.md`、`docs/architecture.md`、`docs/runbooks/{deploy,local-dev}.md`、`CLAUDE.md`、`package.json`（新 deps：`@playwright/test`、`jose`）
- **Breaking changes**：
  - `docs/data-model.md` §Storage RLS 從「signed URL only」改為「bucket public + RLS 限 published」——對齊 design.md §3 決議；下載 GPX 的 client code path 簡化（無需 server action 簽 URL）
  - bootstrap 既有 `(admin)/login`、`(admin)/upload` placeholder pages 從「Coming soon 純 visual」升級為「真實 OAuth flow + 受保護」；外觀無大變化但行為已不同
- **External services touched**：
  - **Supabase**：建立專案、enable `postgis` extension、建立 `gpx` bucket、設定 Authentication → Providers → GitHub
  - **GitHub**：建立 OAuth App（client_id / secret）對應 Supabase callback URL
  - **Vercel**：import GitHub repo、設定 5 個 env vars、啟用 Preview Deployment
- **Risk**：
  - Supabase RLS 寫錯導致 admin 也無法 select → migration 後跑驗證 SQL（acceptance 列入 task 3.5）
  - GitHub OAuth callback URL 在 Supabase Dashboard 設錯 → `docs/runbooks/deploy.md` 新增「OAuth callback 驗證」步驟
  - `jose` 新 dep 需 AGENTS.md「不擅自加 deps」流程確認；若拒絕切替代方案（password-based test user）
  - Playwright OAuth mock fixture 使用 `SUPABASE_JWT_SECRET` 簽 JWT；Supabase 升版可能破壞 cookie 格式

## Related Artifacts

### Design
- [design.md](./design.md) — 完整設計（external setup / DB & Storage / Auth + Middleware + Admin pages / CI & E2E / Risks / Probable next steps）
- [tasks.md](./tasks.md) — 18 個 tasks 分 5 個 group，含 3 個 external setup tasks 標註 prerequisite

### Diagrams
- [Sequence: Admin OAuth Flow](./diagrams/01-sequence-admin-oauth-flow.puml) — 訪客 → /admin/login → GitHub OAuth → Supabase callback → middleware 比對 ADMIN_GITHUB_USERNAME 後分支（PNG 預覽：`diagrams/01-sequence-admin-oauth-flow.png`）
- [ER: routes Table Schema](./diagrams/02-er-routes-schema.puml) — `routes` 完整 schema + 4 個 indexes + 2 條 RLS policies + Storage `gpx` bucket logical FK（PNG 預覽：`diagrams/02-er-routes-schema.png`）

### Figma Designs
- 本 change 不需要 Figma designs：admin pages 是 OAuth button + Coming soon placeholder，沿用 V2 Trail Vintage tokens 即可；design.md §8 已記錄此決策。
