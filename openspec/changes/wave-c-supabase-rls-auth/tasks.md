---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

# Tasks: wave-c-supabase-rls-auth

> 11 個 deferred tasks 沿用 bootstrap 編號（3.1–3.6 / 4.1 / 6.4 / 6.5 / 8.2 / 8.3），另新增 6.6（`/` flash toast）、7.1–7.5（文件更新）、8.4（CI e2e job），共 18 個 tasks。
>
> 「External setup」task（3.1 / 3.2 / 8.2）由 Yuki 在 Supabase / Vercel dashboard 手動完成，SDD/TDD 無法 dispatch；其他 task `prerequisite: external-setup` 標註對應依賴。

## 3. DB & Storage

- [ ] 3.1 [External setup] Supabase project + PostGIS extension + `gpx` Storage bucket
  - Acceptance: WHEN Yuki 開啟 Supabase Dashboard → Database → Extensions THEN `postgis` extension 為 enabled；AND Storage → Buckets 出現 `gpx` bucket 且 public 為 true；AND `.env.local` 含 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 與 `SUPABASE_SERVICE_ROLE_KEY`
  - Depends on: -
  - Independence: external (manual)
  - status: not_started

- [ ] 3.2 [External setup] Supabase Auth GitHub OAuth provider
  - Acceptance: WHEN Yuki 在 Supabase Dashboard → Authentication → Providers → GitHub 開啟 provider 並填入 GitHub OAuth App 的 client_id / client_secret THEN provider 狀態為 enabled；AND GitHub OAuth App 的 Authorization callback URL 設定為 `https://<supabase-ref>.supabase.co/auth/v1/callback`；AND 從 Dashboard → Settings → API 取得 JWT secret 並記入 Yuki 本機 `.env.local` 的 `SUPABASE_JWT_SECRET`（不入 git，僅 E2E fixture 使用）
  - Depends on: 3.1
  - Independence: external (manual)
  - status: not_started

- [ ] 3.3 Drizzle schema for `routes` table（含 `lib/db/postgis.ts` customType helpers）
  - Acceptance: WHEN 開啟 `lib/db/schema.ts` THEN 含 `routes` table 定義且每個欄位對齊 `docs/data-model.md` §`routes` table；AND `bbox` 與 `start_point` 透過 `lib/db/postgis.ts` 的 `customType` 封裝為 `geometry(Polygon, 4326)` / `geometry(Point, 4326)`；AND `difficulty` 為 pgEnum `('easy', 'medium', 'hard')`；AND `pnpm typecheck` exit 0
  - Depends on: 3.1
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.4 Drizzle migration: routes table + 4 個 indexes
  - Acceptance: WHEN 執行 `pnpm db:migrate` THEN migration SQL 套用到 Supabase 且 `routes` table 出現含 design.md §3 所列全部欄位；AND 4 個 indexes（`routes_bbox_gist` / `routes_start_point_gist` / `routes_recorded_at_desc` / `routes_tags_gin`）皆建立；AND migration file commit 在 `lib/db/migrations/`
  - Depends on: 3.3
  - Independence: serial
  - status: not_started

- [ ] 3.5 RLS policies on `routes` + `gpx` bucket（同一個 migration SQL）
  - Acceptance: WHEN 執行 `pnpm db:migrate` 後檢查 Supabase Dashboard → Database → Tables → routes THEN Row Level Security = enabled；AND Policies 上有 `anon_read_published`（FOR SELECT, USING published = true）與 `admin_full_access`（FOR ALL, USING jwt user_name = current_setting）兩條 policy；AND `storage.objects` 上有 `gpx_public_select_published`（含 EXISTS published row 條件）、`gpx_admin_write`、`gpx_admin_modify`、`gpx_admin_delete` 四條 policy；AND 以 anon key 查 `SELECT count(*) FROM routes` 回 0（表初始空 + RLS 任一情形皆應為 0）；NOTE: 完整 RLS 行為驗證（anon 看不見 unpublished row）需要 seed 資料、推到 `feat-admin-gpx-upload`
  - Depends on: 3.4
  - Independence: serial
  - status: not_started

- [ ] 3.6 `lib/supabase/` factories：`browser.ts` / `server.ts` / `middleware.ts`
  - Acceptance: WHEN import `createBrowserClient` from `lib/supabase/browser` 並呼叫 THEN 回傳 Supabase client 可在 "use client" component 使用；AND import `createServerClient` from `lib/supabase/server` 並呼叫 THEN 回傳 client 且在每次 request 內以 `SET LOCAL app.admin_github_username = '<env>'` 灌入 session（若 env 未設則 SET 為空字串）；AND `lib/supabase/middleware.ts` 匯出 `createMiddlewareClient({ req, res })` helper 處理 cookie 雙向寫；AND `pnpm typecheck` exit 0
  - Depends on: 3.1
  - Independence: parallel-safe
  - status: not_started

## 4. Auth & Middleware

- [ ] 4.1 `middleware.ts` admin guard
  - Acceptance: WHEN root `middleware.ts` 存在且 `config.matcher = ['/admin/:path*']` THEN edge runtime 攔截所有 `/admin/*` request；AND 對 `/admin/login` bypass guard 直接 `NextResponse.next()`；AND 對其他 `/admin/*` 未登入 THEN redirect `/admin/login`；AND 登入但 `user_metadata.user_name !== ADMIN_GITHUB_USERNAME` THEN `supabase.auth.signOut()` + redirect `/?auth_error=not_admin`；AND ENV 未設 `ADMIN_GITHUB_USERNAME` THEN fallback「無人是 admin」（fail-closed）
  - Depends on: 3.6
  - Independence: serial
  - status: not_started

## 6. Admin pages + flash toast

- [ ] 6.4 `/admin/login` GitHub OAuth button（取代 bootstrap placeholder）
  - Acceptance: WHEN 訪客 GET `/admin/login` THEN HTTP 200 且不被 middleware redirect；AND 頁面 render shadcn Card + 「以 GitHub 登入」Button；AND 按下 Button 觸發 `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: '<origin>/admin/upload' } })`；AND `app/(admin)/layout.tsx` 對 pathname === `/admin/login` 不顯示上方 admin nav
  - Depends on: 3.6
  - Independence: parallel-safe
  - status: not_started

- [ ] 6.5 `/admin/upload` Coming soon placeholder + sign-out（取代 bootstrap placeholder）
  - Acceptance: WHEN admin GET `/admin/upload` THEN HTTP 200 且顯示「Coming soon · GPX 上傳開發中」訊息；AND 頁面右上角顯示 Sign out Button，按下後呼叫 `supabase.auth.signOut()` 並 redirect `/`；AND 未登入 GET 同路徑 THEN 被 middleware redirect 到 `/admin/login`（由 4.1 保證）
  - Depends on: 4.1
  - Independence: serial
  - status: not_started

- [x] 6.6 `/` flash toast handler for `?auth_error=not_admin`
  - Acceptance: WHEN 訪客 GET `/?auth_error=not_admin` THEN 頁面 mount 時用 sonner 顯示 toast「您不是 admin，已登出」；AND toast 顯示後 client 端 `router.replace('/')` 清除 query param；AND `/` 無 query param 時不顯示 toast
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

## 7. Documentation updates

- [ ] 7.1 Update `docs/data-model.md` §RLS / §Storage RLS / §`gpx_path`
  - Acceptance: WHEN 開啟 `docs/data-model.md` THEN §RLS 對齊 design.md §3 的 `anon_read_published` + `admin_full_access` SQL；AND §Storage RLS 從「Public read disabled, signed URL only」改為「bucket public + policy 限 published」並含 4 條 storage policy SQL；AND §`gpx_path` 描述從「下載按鈕直接給 signed URL」改為「published row 直接給 public URL；草稿不公開」
  - Depends on: 3.5
  - Independence: parallel-safe
  - status: not_started

- [ ] 7.2 Update `docs/architecture.md`：補上 Edge Middleware → Supabase Auth → Postgres `current_setting` 流程圖
  - Acceptance: WHEN 開啟 `docs/architecture.md` THEN 含一段 mermaid sequenceDiagram 描述 admin 點 `/admin/upload` → middleware 抓 session → 比對 `ADMIN_GITHUB_USERNAME` → Postgres SET LOCAL → RLS 放行的順序；AND 圖中清楚標示 Edge runtime vs Node runtime 邊界
  - Depends on: 4.1
  - Independence: parallel-safe
  - status: not_started

- [ ] 7.3 Update `docs/runbooks/deploy.md`：新增 OAuth callback 驗證步驟 + RLS 手動測試 SQL
  - Acceptance: WHEN 開啟 `docs/runbooks/deploy.md` THEN 含「OAuth callback 驗證」章節指出測試命令（`curl supabase.co/auth/v1/callback`）與預期 302 redirect；AND 含「RLS 手動測試 SQL」章節列出三條 sanity SQL（anon select 應 0、service role insert 應成功、anon select 仍 0 因 published=false）
  - Depends on: 3.2, 3.5
  - Independence: parallel-safe
  - status: not_started

- [ ] 7.4 Update `docs/runbooks/local-dev.md`：新增 `pnpm db:migrate` 流程
  - Acceptance: WHEN 開啟 `docs/runbooks/local-dev.md` THEN 含「啟動本地 supabase（或用共用 dev project）」段落（指向 Supabase CLI 或 Yuki 個人 Supabase project）；AND 含「`pnpm db:migrate` 流程」說明（generate → review SQL → migrate）
  - Depends on: 3.4
  - Independence: parallel-safe
  - status: not_started

- [ ] 7.5 Update `CLAUDE.md` 常用指令表
  - Acceptance: WHEN 開啟 `CLAUDE.md` 常用指令表 THEN `pnpm db:migrate` 的「What it does」欄不再標註 _Wave B_；AND `pnpm test:e2e` 的「What it does」欄不再標註 _Wave C_，皆改為現役狀態描述
  - Depends on: 3.4, 8.3
  - Independence: parallel-safe
  - status: not_started

## 8. CI & deployment

- [ ] 8.2 [External setup] Vercel project + Preview deployment
  - Acceptance: WHEN Yuki 在 Vercel Dashboard import GitHub repo THEN 專案建立成功；AND Build Command 為 `pnpm build`、Install Command 為 `pnpm install`；AND Project Settings → Environment Variables 含 5 個（`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_GITHUB_USERNAME=bibiota` / `NEXT_PUBLIC_PMTILES_URL`）；AND 開一個 PR 後 Vercel 自動 deploy preview 並在 PR comment 出 preview URL
  - Depends on: 3.1, 3.2
  - Independence: external (manual)
  - status: not_started

- [ ] 8.3 Playwright config + OAuth mock fixture + 5 specs
  - Acceptance: WHEN 安裝 `@playwright/test` 與 `jose` 為 devDependencies 並 `pnpm exec playwright install --with-deps chromium` THEN Playwright 可執行；AND `playwright.config.ts` 設 `webServer: { command: 'pnpm start', port: 3000 }`；AND `e2e/fixtures/admin-session.ts` 使用 `SignJWT` + `SUPABASE_JWT_SECRET` 簽 JWT 並 inject Supabase auth cookie；AND 5 個 spec 檔（`visitor-home.spec.ts` / `visitor-list.spec.ts` / `visitor-detail.spec.ts` / `admin-unauthenticated.spec.ts` / `admin-login-flow.spec.ts`）全部存在；AND `pnpm test:e2e` 對 `pnpm build && pnpm start` 起的 prod server 5 個 spec 全 pass on local
  - Depends on: 4.1, 6.4, 6.5
  - Independence: serial
  - status: not_started

- [ ] 8.4 GitHub Actions `e2e` job
  - Acceptance: WHEN PR 開啟 THEN `.github/workflows/ci.yml` 既有 `lint` / `typecheck` / `test` 三 job 後新增 `e2e` job 並執行 `pnpm install` → `playwright install chromium` → `pnpm build` → `pnpm test:e2e`；AND job env 含 5 + 1 = 6 個 secrets（含 `SUPABASE_JWT_SECRET` for E2E mock）；AND job 條件 `if: github.event.pull_request.head.repo.full_name == github.repository`（Fork PR 不觸發、避免 secrets 洩漏）；AND 任一 spec fail 則 job 紅 X
  - Depends on: 8.3
  - Independence: serial
  - status: not_started

## Optional artifacts

- [x] PlantUML diagrams:
  - [01-sequence-admin-oauth-flow.puml](./diagrams/01-sequence-admin-oauth-flow.puml) — admin OAuth flow（含 middleware mismatch alt 分支）
  - [02-er-routes-schema.puml](./diagrams/02-er-routes-schema.puml) — `routes` table + indexes + RLS + `gpx` bucket logical FK
- [ ] Figma designs (spec-driven-dev:writing-figma)
