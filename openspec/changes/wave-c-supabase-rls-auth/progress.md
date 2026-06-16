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
