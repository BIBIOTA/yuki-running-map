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
