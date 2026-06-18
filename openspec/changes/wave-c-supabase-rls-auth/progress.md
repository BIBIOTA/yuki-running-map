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
