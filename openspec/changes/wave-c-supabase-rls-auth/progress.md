---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

# Progress: wave-c-supabase-rls-auth

## Session 1 — 2026-06-16 18:30
- Stage: TDD
- Task: 6.6 `/` flash toast handler for `?auth_error=not_admin`
- Transition: not_started → in_progress
- Next action: 寫 Vitest failing tests（對應 spec.md `placeholder-pages` MODIFIED Requirement 的兩個 NEW Scenarios：lands with auth_error flash / lands without flash；既有 "lands on home" 由 bootstrap 涵蓋），確認測試以正確原因失敗後 commit `test: red - 6.6 flash toast`

## Session 2 — 2026-06-16 18:30
- Stage: TDD
- Task: 6.6 `/` flash toast handler for `?auth_error=not_admin`
- Transition: in_progress → passing
- Evidence:
  - Commits: `0eafd52` test(wave-c): red - 6.6 handleAuthErrorFlash flash toast; `a053218` feat(wave-c): green - 6.6 / flash toast handler for auth_error=not_admin; `6c9e710` refactor(wave-c): simplify AuthErrorFlash deps wrapping
  - Tests: `pnpm exec vitest run` → 3 Test Files / 10 Tests all passing（features/auth-flash 2 + 既有 lib/gpx 8）
  - Smoke: dev server curl `/` 與 `/?auth_error=not_admin` 都 HTTP 200；html grep 含 AuthErrorFlash + sonner
  - Note: 採 dependency injection 設計、避免新增 testing-library/jsdom deps；toast 視覺渲染由後續 task 8.3 (Playwright E2E) end-to-end 驗證
- Next action: 進入 dep approval 階段——一次列出後續 tasks 所需新 deps（@supabase/ssr、drizzle-orm、drizzle-kit、@playwright/test、jose）請 Yuki 核可，再啟動 task 3.3（Drizzle schema for routes）

## Session 3 — 2026-06-16 19:00
- Stage: TDD
- Task: 3.3 Drizzle schema for `routes` table
- Transition: not_started → in_progress
- Next action: 寫 schema-shape Vitest failing tests（對應 spec.md `data-and-auth-infrastructure` ADDED Requirement "Drizzle schema defines the routes table" 兩個 Scenarios：typecheck pass + columns reachable / bbox+start_point use customType），先確認測試以「找不到 lib/db/schema」失敗後 commit `test: red - 3.3 routes schema`

## Session 4 — 2026-06-16 19:02
- Stage: TDD
- Task: 3.3 Drizzle schema for `routes` table
- Transition: in_progress → passing
- Evidence:
  - Commits: `c246bcd` test(wave-c): red - 3.3 routes schema shape; `7db1813` feat(wave-c): green - 3.3 Drizzle schema for routes table
  - Tests: `pnpm exec vitest run lib/db` → 1 Test File / 2 Tests pass；全專案 4 Test Files / 12 Tests pass；typecheck + lint exit 0
  - No refactor 需求（schema 已自洽）
  - Diagram coverage: ER diagram (02-er-routes-schema.puml) 的 20 個欄位 / bbox geometry(Polygon,4326) / start_point geometry(Point,4326) / difficulty enum 全部由 schema-shape test 斷言到
- Next action: 啟動 task 3.6（lib/supabase/ factories）——也是 pure code、可 mock Supabase client 做單元測試

## Session 5 — 2026-06-16 19:15
- Stage: design pivot（無 task transition）
- Decision: 把 admin username 從「per-request SET LOCAL」改為「DB-level `ALTER DATABASE postgres SET app.admin_github_username = ...`」
  - Why: Supabase JS client 走 PostgREST connection pool，無法 per-request SET LOCAL
  - Updated artifacts:
    - design.md §3：RLS 段落改寫 + 加上 "設計取捨" 註記
    - tasks.md task 3.5：acceptance 加入 `ALTER DATABASE` 條款
    - tasks.md task 3.6：acceptance 移除「SET LOCAL 灌入 session」條款，改為「wrap @supabase/ssr + cookies」
    - specs/data-and-auth-infrastructure/spec.md "Supabase client factories" Requirement：Scenario `createServerClient sets app.admin_github_username` 換成 `createServerClient wraps @supabase/ssr with next/headers cookies`
    - 同 spec "RLS policies enforce admin and public access" Requirement：加入 ALTER DATABASE 描述 + 新 Scenario `app.admin_github_username GUC is set at the database level`
  - Validation: `openspec validate wave-c-supabase-rls-auth --strict` exit 0
- Next action: 下一 session resume 後，先以 `spec-driven-dev:resume-change` 確認目前 in-flight state（tasks 6.6 + 3.3 passing、其餘 not_started），再啟動 task 3.6（lib/supabase/ factories）；其後依序推 4.1 (middleware) → 6.4 (/admin/login) → 6.5 (/admin/upload)。external setup（3.1 / 3.2 / 8.2）與 migration tasks（3.4 / 3.5）等 Yuki 完成 Supabase + GitHub OAuth + Vercel dashboard 設定後再 dispatch。

## Session 6 — 2026-06-16 20:00
- Stage: TDD
- Task: 3.6 `lib/supabase/` factories
- Transition: not_started → in_progress
- Next action: 寫 Vitest module mock failing tests（對應 spec.md `data-and-auth-infrastructure` "Supabase client factories are exported from lib/supabase" Requirement 三個 Scenarios：browser callable / server wraps @supabase/ssr with next/headers cookies / middleware round-trips cookies），先確認測試以「找不到 lib/supabase/{browser,server,middleware}」失敗後 commit `test: red - 3.6 supabase factories`

## Session 7 — 2026-06-16 20:25
- Stage: TDD
- Task: 3.6 `lib/supabase/` factories
- Transition: in_progress → passing
- Evidence:
  - Commits: `3be80f7` test(wave-c): red - 3.6 lib/supabase factories; `3376421` feat(wave-c): green - 3.6 lib/supabase factories
  - Tests: `pnpm exec vitest run lib/supabase` → 1 Test File / 3 Tests pass；全 suite 5 Test Files / 15 Tests pass；typecheck + lint exit 0
  - No refactor 需求（factories 已乾淨）
  - Diagram coverage: 對應 sequence diagram (01-sequence-admin-oauth-flow.puml) 的 cookies 路由——test 已斷言 next/headers cookies + req/res cookies 兩條 path 都正確接入 @supabase/ssr。
  - Red strategy: skeleton modules throw "not implemented" 讓 typecheck/lint 不破，test 以行為原因 fail。
- Next action: 啟動 task 4.1（root `middleware.ts` admin guard）——使用 3.6 的 createMiddlewareClient + ADMIN_GITHUB_USERNAME env match。test 用 vi.mock 把 `@/lib/supabase/middleware` 與 `next/server` 的 NextResponse 一起 stub。

## Session 8 — 2026-06-16 20:30
- Stage: TDD
- Task: 4.1 `middleware.ts` admin guard
- Transition: not_started → in_progress
- Next action: 寫純函式 `lib/auth/admin-guard.ts#decideAdminGuard` 的 5 個 failing tests（對應 spec.md `data-and-auth-infrastructure` "middleware.ts guards admin routes" Requirement 五個 Scenarios：/admin/login bypass / unauthenticated redirect / admin reaches /admin/upload / non-admin sign-out + flash / missing env blocks everyone），先 skeleton stub throw "not implemented" 保持 typecheck+lint 綠燈，commit `test: red - 4.1 admin guard decision`

## Session 9 — 2026-06-16 20:40
- Stage: TDD
- Task: 4.1 `middleware.ts` admin guard
- Transition: in_progress → passing
- Evidence:
  - Commits: `d35b588` test(wave-c): red - 4.1 admin guard decision; `58f8e3d` feat(wave-c): green - 4.1 middleware.ts admin guard
  - Tests: `pnpm exec vitest run lib/auth` → 1 Test File / 5 Tests pass；全 suite 6 Test Files / 20 Tests pass；typecheck + lint exit 0
  - 無 refactor 需求（admin-guard 為簡單 if-else cascade、middleware.ts 為 thin switch wiring）
  - Diagram coverage: sequence diagram (01-sequence-admin-oauth-flow.puml) §5 alt 分支兩條（admin 放行 / 非 admin sign-out + redirect /?auth_error=not_admin）皆由 decideAdminGuard 5 個 unit tests 斷言；middleware.ts NextResponse + signOut 接線由 task 8.3 E2E 驗證
  - 設計亮點: /admin/login bypass 早 return 在 createMiddlewareClient + auth.getUser() 之前，符合 spec scenario 1「middleware does not call auth.getUser()」要求
- Next action: 啟動 task 6.4（/admin/login GitHub OAuth button Client Component）——使用 createBrowserClient + supabase.auth.signInWithOAuth provider=github。test 把 createBrowserClient mock 起來、斷言 button click 觸發正確 signInWithOAuth args。

## Session 10 — 2026-06-16 20:50
- Stage: TDD
- Task: 6.4 `/admin/login` GitHub OAuth button
- Transition: not_started → in_progress
- Next action: 寫純函式 failing tests（對應 placeholder-pages ADDED Requirement "/admin/login authenticates admin via GitHub OAuth" 兩個 Scenarios：Visitor opens login page / Clicking the button starts OAuth flow），抽 helpers `handleGithubSignIn`（OAuth call）與 `shouldHideAdminNav`（pathname 規則）到 features/admin-auth/，skeleton throw "not implemented"，commit `test: red - 6.4 admin login`

## Session 11 — 2026-06-16 20:50
- Stage: TDD
- Task: 6.4 `/admin/login` GitHub OAuth button
- Transition: in_progress → passing
- Evidence:
  - Commits: `f3a6453` test(wave-c): red - 6.4 admin login OAuth + nav suppression; `6b76626` feat(wave-c): green - 6.4 /admin/login GitHub OAuth + nav suppression
  - Tests: 全 suite 7 Test Files / 22 Tests pass；typecheck + lint exit 0
  - Smoke：dev server 上 `/admin/login` HTTP 200 含 "Admin 登入" Card + "使用 GitHub 帳號" description + "以 GitHub 登入" button；admin top-nav 不顯示（無 "Sign out" / "Yuki's Running Map · Admin" 文字）；`/admin/upload` HTTP 307 → `/admin/login`
  - Diagram coverage: sequence diagram (01-sequence-admin-oauth-flow.puml) §1 進入登入頁、§2 觸發 OAuth、middleware bypass note 全部由 shouldHideAdminNav + handleGithubSignIn + middleware bypass behavior 對齊
  - 設計亮點:
    - URL routing 修正：bootstrap 的 (admin) 是 Next.js route group 不加 URL prefix，需 `app/(admin)/admin/{login,upload}/` 才對應 `/admin/*`
    - middleware env-check fallback：缺 SUPABASE env 時 redirect /admin/login（dev 友善，prod 有 env 不影響）
    - login page lazy createBrowserClient 在 onClick 內避免 SSR crash on missing env
    - admin layout 拆出 `AdminTopNav` Client Component 以使用 `usePathname()` 而 layout 本身仍是 Server Component
- Next action: 啟動 task 6.5（/admin/upload Coming soon + sign-out）——使用 createBrowserClient 在 sign-out button onClick 呼叫 auth.signOut() + router.push('/')；admin top-nav 的 Sign out button 也一併接通

## Session 12 — 2026-06-16 21:00
- Stage: TDD
- Task: 6.5 `/admin/upload` Coming soon + sign-out
- Transition: not_started → in_progress
- Next action: 寫純函式 `handleSignOut` failing test（對應 placeholder-pages ADDED Requirement "/admin/upload shows the Coming soon placeholder for authenticated admin" Scenario "Sign out clears the session"），skeleton throw "not implemented"，commit `test: red - 6.5 sign out`

## Session 13 — 2026-06-16 21:05
- Stage: TDD
- Task: 6.5 `/admin/upload` Coming soon + sign-out
- Transition: in_progress → passing
- Evidence:
  - Commits: `22e0798` test(wave-c): red - 6.5 sign out; `6a9a51d` feat(wave-c): green - 6.5 /admin/upload + sign-out
  - Tests: 全 suite 8 Test Files / 23 Tests pass；typecheck + lint exit 0
  - Smoke：dev server `/admin/upload` HTTP 307 → `/admin/login`（env 未設、middleware 早 return）；AdminTopNav 從 placeholder disabled button 升為功能性 Sign out（onClick → lazy createBrowserClient → handleSignOut）
  - Scenario "Authenticated admin sees the placeholder" 標 `verification-pending: e2e`（need external setup + task 8.3 OAuth mock fixture 才能 end-to-end 驗證）
  - Diagram coverage: sequence diagram (01-sequence-admin-oauth-flow.puml) §6「(選用) Sign out → supabase.signOut() → cookie cleared, 302 → /」由 handleSignOut 單元測試斷言
- Next action: 5 個 code-only tasks 全部 passing（6.6 / 3.3 / 3.6 / 4.1 / 6.4 / 6.5），剩餘 12 個 tasks 等 external setup：3.1 / 3.2 / 8.2（Yuki Supabase + Vercel dashboard 手動）、3.4 / 3.5 / 7.1 / 7.2 / 7.3 / 7.4 / 7.5（migration + docs，需 Supabase live）、8.3 / 8.4（E2E + CI，需所有 env 就緒）。Session 收尾建議：等 Yuki 完成 deploy runbook 後 resume 跑剩餘 tasks。

## Session 14 — 2026-06-16 21:15
- Stage: implementation (docs — non-TDD)
- Task: 7.1 Update `docs/data-model.md`
- Transition: not_started → in_progress → passing
- Evidence:
  - §RLS 對齊 design.md §3：`anon_read_published` + `admin_full_access`、ALTER DATABASE GUC 段落
  - §Storage RLS：4 條 policy SQL（`gpx_public_select_published` / `gpx_admin_write` / `gpx_admin_modify` / `gpx_admin_delete`）
  - §`gpx_path`：從「signed URL」改為「published 直接 public URL；草稿 policy 過濾」
  - Grep verify：6 個 policy 名稱 + ALTER DATABASE 段落 + 草稿描述全部出現
- Next action: 啟動 task 7.2（docs/architecture.md 新增 middleware → Supabase mermaid）

## Session 15 — 2026-06-16 21:25
- Stage: implementation (docs)
- Task: 7.2 Update `docs/architecture.md`
- Transition: not_started → in_progress → passing
- Evidence:
  - 新增 `## Admin auth flow (Edge middleware → Supabase Auth → Postgres GUC)` 段落
  - Mermaid sequenceDiagram 涵蓋 6 個 participant（Yuki/Browser/MW/Auth/Page/PG）+ alt 分支（放行 vs 擋下 sign-out + redirect）
  - Notes 標明 Edge runtime / Node runtime boundary 與 ALTER DATABASE GUC（取代原 SET LOCAL）
  - 後續 prose 列出 3 個 boundary：Edge / Node / Postgres GUC
  - Grep verify：sequenceDiagram + Edge runtime + Node runtime + ADMIN_GITHUB_USERNAME + ALTER DATABASE + app.admin_github_username 全部存在
- Next action: 啟動 task 7.3（docs/runbooks/deploy.md 新增 OAuth callback 驗證 + RLS 手動測試 SQL）

## Session 16 — 2026-06-18 19:00
- Stage: implementation (docs)
- Task: 7.3 Update `docs/runbooks/deploy.md`
- Transition: in_progress → passing
- Evidence:
  - §3 內新增「### Verify OAuth callback」子節：`curl -i "https://<your-supabase-ref>.supabase.co/auth/v1/callback"` + 常見失敗模式（404 provider 未啟用 / `provider not supported` / GitHub OAuth App callback URL mismatch）
  - 新增「## 7. RLS sanity SQL」段落（位於 §6 與 Maintenance 之間），列出 3 條 sanity SQL：
    - Query A：anon `SELECT count(*) FROM routes` → 0（空表）
    - Query B：service_role INSERT draft row（`published = false`）→ 1 row returned
    - Query C：anon `SELECT count(*) FROM routes` → 仍為 0（`anon_read_published` 過濾掉 draft）
    - Clean up：service_role `DELETE` 移除 sanity row
  - Grep verify：`RLS sanity SQL` / `Query A|B|C` / `anon_read_published` / `service_role` / `rls-sanity-draft` 全部出現
- Next action: 啟動 task 7.4（docs/runbooks/local-dev.md 新增 啟動本地 supabase + `pnpm db:migrate` 流程）

## Session 17 — 2026-06-18 19:10
- Stage: implementation (docs)
- Task: 7.4 Update `docs/runbooks/local-dev.md`
- Transition: not_started → in_progress → passing
- Evidence:
  - 「## Local Supabase」新章節（Option A 共用 dev project / Option B Supabase CLI emulator `supabase start` + `CREATE EXTENSION postgis`）
  - 「## Database migrations」新章節：5-step workflow（edit schema → `pnpm db:generate` → review SQL → `pnpm db:migrate` → RLS sanity SQL cross-link 到 deploy.md §7）+ 後續修補需另起 migration（保留 journal）
  - Useful commands 段落更新：`pnpm db:migrate` 已脫離 Wave B 標籤，僅 `pnpm test:e2e` 還在 Wave C
  - Environment variables 內舊的「For a quick local Supabase」段落替換為指向 Local Supabase Option B 的 anchor
  - Grep verify：`Local Supabase` / `Option A` / `Option B` / `supabase start` / `pnpm db:generate` / `pnpm db:migrate` / `Database migrations` / `ALTER DATABASE GUC` / `RLS sanity SQL` 全部出現
- Next action: 7.5 依賴 task 3.4 + 8.3（需 migration + e2e 真正執行通），先 skip；docs 階段任務（7.1–7.4）全部 passing。下一個可推進的 code-only 工作不多，建議 session 收尾並等 Yuki 完成 external setup（3.1 / 3.2 / 8.2 + 3.4 / 3.5 migration apply + 8.3 / 8.4 E2E + CI），再 resume 跑剩餘 9 個 tasks。

## Session 18 — 2026-06-18 22:00
- Stage: external setup landed + dispatch 3.4
- External: Yuki 完成 3.1（Supabase project + PostGIS via `CREATE EXTENSION` from `.env.local` 連線 / pgcrypto 預設已 enable）+ 3.2（GitHub OAuth App + Supabase Provider）
- `.env.local` 落地：補 `DATABASE_URL` + `SUPABASE_JWT_SECRET` 兩 var；direct connection (`db.<ref>.supabase.co:5432`) IPv6-only 不可達，改用 Session Pooler (`aws-1-ap-northeast-1.pooler.supabase.com:5432`, IPv4 supavisor) 等價於 direct；password 含 `!` URL-encode 為 `%21`
- `.env.example` 同步補 2 個新 var + 註釋說明來源
- Task: 3.4 Drizzle migration routes table + 4 indexes
- Transition: not_started → in_progress → passing
- Evidence:
  - schema fix：`createdAt` / `updatedAt` 補 `.notNull()`（修 3.3 漏掉的）+ 新增 4 個 indexes（bbox GIST / start_point GIST / recorded_at btree DESC NULLS LAST / tags GIN）
  - `drizzle.config.ts` 建：postgresql dialect / schema=lib/db/schema.ts / out=lib/db/migrations / casing=snake_case / strict+verbose / `DATABASE_URL` 缺則 throw
  - `package.json` 新 scripts：`db:generate` / `db:migrate` / `db:studio`（皆用 `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <cmd>` wrap）
  - `pnpm db:generate` → `lib/db/migrations/0000_famous_lionheart.sql`（1 table / 20 columns / 4 indexes / 0 fks）+ `meta/_journal.json` 記錄 idx 0
  - `pnpm db:migrate` → ✅ applied successfully
  - DB 驗證：20 columns 對齊 design.md 全部 NOT NULL/NULL 正確、4 indexes + pkey + slug unique 都存在、`routes` 0 rows、`difficulty` enum 存在
  - `pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm exec vitest run` 8 files / 23 tests 全 pass
- Next action: 啟動 task 3.5（RLS policies + storage policies + `ALTER DATABASE` GUC）—— Drizzle 不自動產生 RLS，需 `drizzle-kit generate --custom` 起一個空 migration、手寫 SQL（2 條 routes policy + 4 條 storage.objects policy + 1 條 ALTER DATABASE）+ `ENABLE ROW LEVEL SECURITY`，再 `pnpm db:migrate` 套用。完成後跑 deploy.md §7 三條 sanity SQL 驗證行為。

## Session 19 — 2026-06-18 22:25
- Stage: design pivot + implementation (migration)
- Task: 3.5 RLS policies + storage policies + admin identity SQL function
- Transition: not_started → in_progress → passing
- Decision: 把 admin identity 從「migration `ALTER DATABASE postgres SET app.admin_github_username = ...`」改為「migration `CREATE OR REPLACE FUNCTION public.app_admin_github_username() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'bibiota'::text $$`」
  - Why: Supabase managed `postgres` role 沒權限改 cluster-level custom parameter（試跑 `ALTER DATABASE` 報 `permission denied to set parameter`）
  - Pivot 後好處：migration 內自洽（不依賴 Supabase 提權）、IMMUTABLE function 讓 planner inline、admin identity 完全鎖在 migration 控制下
  - Trade-off：`public.app_admin_github_username()` 的回傳值與 `ADMIN_GITHUB_USERNAME` env 變成兩個獨立事實源，需保持手動同步；改 admin 要起 follow-up migration（個人專案可接受）
- Evidence:
  - Migration: `lib/db/migrations/0001_rls_policies_and_storage_buckets.sql` 含 7 個 statement-breakpoint：
    1. `INSERT INTO storage.buckets` gpx (public=true) + 2. tiles (public=true)，皆 `ON CONFLICT DO UPDATE` 保持 idempotent
    3. `CREATE OR REPLACE FUNCTION public.app_admin_github_username()` IMMUTABLE SQL function
    4. `ALTER TABLE routes ENABLE ROW LEVEL SECURITY` + 5–6. `anon_read_published` (SELECT, USING `published = true`) + `admin_full_access` (ALL, USING + WITH CHECK 比對 jwt.user_name 與 function)
    7–10. `gpx_public_select_published` (SELECT, EXISTS published row) + `gpx_admin_write` (INSERT) + `gpx_admin_modify` (UPDATE) + `gpx_admin_delete` (DELETE)
  - `pnpm db:migrate` → ✅ migrations applied successfully（idx 1 落地、`__drizzle_migrations` 有 row）
  - 一次性 `scripts/verify-rls.mjs`（已刪除）查驗 DB：`routes.relrowsecurity=true`、2 routes policies + 4 gpx storage policies 齊全、`SELECT public.app_admin_github_username()` 回 `'bibiota'`、`storage.buckets` 兩個 bucket public=true
  - deploy.md §7 三條 sanity SQL 走過：Query A anon `SELECT count(*) FROM routes` → 0；Query B service_role INSERT draft (`published=false`) → returning id；Query C anon `SELECT count(*) FROM routes` → 仍 0（draft 被 `anon_read_published` 過濾）；Cleanup `DELETE FROM routes WHERE slug = 'rls-sanity-draft'` 成功
  - `pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm exec vitest run` 8 files / 23 tests 全 pass
  - Updated artifacts (spec compliance):
    - design.md §3：RLS policies + Storage policies 全部改寫為 `public.app_admin_github_username()` reference；新增 Session 19 「兩次 pivot」設計取捨段落；§6 文件更新清單對 architecture.md 描述更新；Risk 表格替換掉 `SET LOCAL` 行
    - tasks.md task 3.5 acceptance 改寫（policy expression、function CREATE OR REPLACE 條款、storage.buckets idempotent insert 條款）+ status passing；task 7.2 Note 補上 Session 19 pivot
    - specs/data-and-auth-infrastructure/spec.md "RLS policies enforce admin and public access" Requirement：重寫 description + 替換 "GUC set at the database level" Scenario 為 "Admin identity function returns the configured GitHub username"，新增 "gpx and tiles buckets are provisioned by the migration" Scenario；"Supabase client factories" Requirement description 同步修正
    - docs/data-model.md §RLS：admin identity function 段落、policy SQL `public.app_admin_github_username()`、Storage 段落補上「migration 內聯 `INSERT INTO storage.buckets` ON CONFLICT」描述
    - docs/architecture.md：sequenceDiagram participant + Note + key boundaries prose + section header 全部改寫為 `public.app_admin_github_username()` IMMUTABLE function；保留 history 註記
    - docs/runbooks/local-dev.md：generate-review checklist 條款改寫
    - deploy.md §1 step 5：Supabase Dashboard 手動建 bucket 步驟改為「Recommended: skip; migration creates buckets」（仍保留 manual fallback）
  - Validation: `openspec validate wave-c-supabase-rls-auth --strict` exit 0
- Next action: Code/migration 路徑全綠。剩 9 個 deferred tasks：3.1 / 3.2 / 8.2 (Yuki external manual setup)、7.5 / 8.3 / 8.4 (E2E + CI + CLAUDE.md 收尾，依賴 dep approval 與 external env)。等 Yuki ack：(a) 確認 3.5 pass acceptance；(b) 是否要繼續 pursue dep approval（@playwright/test、jose）跑 8.3。

## Session 20 — 2026-06-18 22:35
- Stage: status sync (external setup)
- Task: 3.1 + 3.2（Supabase project + GitHub OAuth provider）
- Transition: not_started → passing
- Decision: Session 18 + 19 evidence 已涵蓋兩個 task 的 acceptance：3.1 由 `pnpm db:migrate` 對 Supabase 套用成功 + RLS sanity SQL 三條全綠間接驗證；3.2 由 `.env.local` 含 `SUPABASE_JWT_SECRET` + Provider enabled 表示完成。callback URL 的 end-to-end 驗證留給 8.3 `admin-login-flow.spec.ts`
- Evidence:
  - tasks.md 3.1 + 3.2 status 從 not_started → passing；Acceptance 各補 Evidence row 指向 Session 18 + 19
  - 兩個 task 都標 external 因此沒 commit hash；evidence 走 progress trail + 已通過 migration 為 proof
  - Validation: `openspec validate wave-c-supabase-rls-auth --strict` exit 0
- Next action: 啟動 task 8.3 前要先 dep approval — `@playwright/test` (devDep)、`jose` (devDep)。已向 Yuki 提交 dep proposal（用途、bundle 影響、替代方案、風險）等回覆。8.2 (Vercel) 需 Yuki 走 dashboard 流程，與 dep approval 平行進行不互斥。

## Session 21 — 2026-06-18 22:50
- Stage: debugging (system-debugging skill)
- Trigger: Yuki 嘗試走 OAuth 失敗，看到 `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`
- Root cause（迭代 3 層）：
  1. Supabase Dashboard → Authentication → Providers → GitHub Enabled toggle 沒打開（Yuki 之前只填 client_id/secret 但沒 enable）→ 修：Yuki dashboard 打開 toggle + save
  2. GitHub OAuth App client_id 欄填的是 app 名稱 `yuki-running-map` 而非真實 client_id（Yuki 看 GitHub OAuth App 設定頁複製 client_id 字串到 Supabase）
  3. `ADMIN_GITHUB_USERNAME=bibiota` 但 GitHub 回的 `user_metadata.user_name='BIBIOTA'`（大寫），middleware 比對 mismatch → signOut + redirect `/?auth_error=not_admin` → 回 /admin/login
- Evidence:
  - `debugging-report.md` 寫入（symptom / repro / observation plan / evidence / data flow trace / hypothesis / next action）
  - 決定性證據：`curl ${SUPABASE_URL}/auth/v1/settings` → `external.github = false`
  - `curl ${SUPABASE_URL}/auth/v1/admin/users` after first OAuth 成功 → 拿到 row id `d5a91e9c-...`、`user_metadata.user_name = "BIBIOTA"`、`email = "yukiotataitien@gmail.com"`
- Resolution:
  - `.env.local` `ADMIN_GITHUB_USERNAME=BIBIOTA`
  - `.env.example` 補上「must match exact case GitHub returns in OAuth user_metadata」註解 + 提及 SQL function 需同步
  - migration `0002_sync_admin_username_uppercase.sql`：`CREATE OR REPLACE FUNCTION public.app_admin_github_username() ... AS $$ SELECT 'BIBIOTA'::text $$;`
  - `pnpm db:migrate` → ✅；驗證 `SELECT public.app_admin_github_username()` → `'BIBIOTA'`
- Next action: Yuki kill 掉 dev server + 重跑 `pnpm dev` 重新走一次 OAuth 看是否進到 `/admin/upload`

## Session 22 — 2026-06-18 23:05
- Stage: debugging (system-debugging skill, 接續 Session 21)
- Symptom 2: Yuki 完成 OAuth 但被踢回 `/admin/login`（URL 純粹 `/admin/login` 無 query；dev server 已 Ctrl+C 重啟）
- Root cause: 缺一個 `/auth/callback` Route Handler 來執行 PKCE code exchange。`@supabase/ssr` 預設走 PKCE，Supabase 在 OAuth 完成後 redirect `?code=...` 到 redirectTo，需要 server-side `auth.exchangeCodeForSession(code)` 才會把 session cookie 寫進去；但 `handleGithubSignIn` 把 redirectTo 設成 `/admin/upload`，middleware 在 code exchange 之前 run、看不到 cookie → redirect `/admin/login`
- 原 design.md §4 Auth flow 描述「supabase.co/auth/v1/callback → 換 session cookie → 回 /admin/upload，cookie 已存在」是**錯**的——supabase.co domain 寫的 cookie 跨不了 domain
- Evidence:
  - 查 `app/` 沒有 `/auth/callback` route
  - `app/(admin)/admin/login/page.tsx` + `features/admin-auth/handleGithubSignIn.ts` 都把 redirectTo 設成 `/admin/upload`
- Resolution:
  - 新增 `app/auth/callback/route.ts`：GET handler 讀 `?code=&next=`、呼叫 `supabase.auth.exchangeCodeForSession(code)`、成功 302 → `next`、失敗 302 → `/admin/login?error=oauth_(missing_code|exchange_failed)`
  - `features/admin-auth/handleGithubSignIn.ts`：`redirectTo` 改為 `${origin}/auth/callback?next=/admin/upload`
  - `features/admin-auth/__tests__/login.test.ts` 更新斷言
  - design.md §4 Auth flow 改寫流程圖 + 加「為什麼需要 /auth/callback」段落
  - specs/data-and-auth-infrastructure/spec.md 新增 ADDED Requirement「`/auth/callback` exchanges PKCE code for a session」+ 4 個 Scenarios
- Validation:
  - dev server curl `/auth/callback?code=fake` → 307 → `/admin/login?error=oauth_exchange_failed`（route handler 上線）
  - Yuki Cmd+Shift+R refresh /admin/login 後點「以 GitHub 登入」→ 完整走通 → 看到「Coming soon · GPX 上傳開發中」+ Sign out button
- Next action: 重跑 `pnpm test:e2e`，spec 5 用 admin Magic Link API 走 implicit flow 拿真 access_token + refresh_token 包成 cookie

## Session 23 — 2026-06-18 23:20
- Stage: TDD-like (e2e implementation + spec sync)
- Task: 8.3 Playwright config + admin session via magic link + 5 specs
- Transition: not_started → in_progress → passing
- Evidence:
  - `playwright.config.ts`：chromium-only / webServer `pnpm start --port ${E2E_PORT:-3000}` reuseExistingServer in dev / baseURL / trace retain-on-failure / fullyParallel
  - `package.json` `test:e2e` script：`node --env-file=.env.local ./node_modules/@playwright/test/cli.js test`（自動載入 env，避免 playwright CLI shim 不認 --env-file）
  - 5 個 spec：visitor-home / visitor-list / visitor-detail (2 slug 共 2 test) / admin-unauthenticated / admin-login-flow → 6 test 全 pass
  - **3 個 design pivot during implementation**：
    1. dep：原 plan `jose` SignJWT 自造 admin JWT → Playwright 1.61 對 jose@6 webapi-only conditional exports 的 ESM loader `context.conditions?.includes` 拋 `TypeError`；改用 node 內建 `crypto.createHmac` 自簽 → 自簽通過 typecheck/lint 但 middleware getUser 拒（user UUID fabricate、Supabase 不認）→ 最後改用 Admin API `generate_link(type=magiclink)` 換真 access_token，刪掉 `jose` dep
    2. fixture 拆檔：原 plan `e2e/fixtures/admin-session.ts` → Playwright 1.61 ESM loader 對 testDir 內 relative TS import 同樣拋 `context.conditions?.includes`；inline 進 spec 5 file 規避
    3. cookie 格式：原 plan 直接 inject `sb-<ref>-auth-token` cookie → @supabase/ssr 用 `base64-` prefix + base64url(JSON.stringify(session)) 包 session、Buffer base64url 路徑 + 真 access_token (claims `sub`、`iss`、`exp` 都是 Supabase 真鑄出來的) 可被 middleware getUser 接受
  - 全 suite：6 e2e pass / typecheck exit 0 / lint exit 0 / vitest 8 files / 23 tests pass
- Next action: 剩 task 7.5 (CLAUDE.md 更新)、8.2 (Vercel external)、8.4 (CI yml)、3.1/3.2 已 Session 20 標 passing。可下一輪推 7.5（純文件）+ 詢問 8.4 是否要動 CI yml（依賴 Yuki 設 GitHub Actions secrets）。
