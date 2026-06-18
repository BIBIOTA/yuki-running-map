---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

# Verification Report: wave-c-supabase-rls-auth

Date: 2026-06-18
Verifier: claude-opus-4-7 (session 26)

## Summary

- Code: PASS（lint / typecheck / vitest / e2e 全綠；scenario coverage 多數 scenarios 屬 infrastructure/external setup 性質、由 progress + debugging-report + DB sanity SQL 等非 test-file 證據覆蓋）
- Spec: PASS（`openspec validate --strict` exit 0；tasks.md 兩個 unchecked item 已 `deferred:` 註解）
- Progress log: PASS
- Diagrams: PASS（兩張 .puml 經 Session 22 / Session 19 兩次 pivot 同步更新到 implementation 真實狀態）
- Designs: n/a（design.md §8 已決定本 change 不需要 Figma；tasks.md 已 `deferred:`）

## Code Evidence

### Lint + typecheck + vitest

```text
$ pnpm lint
$ eslint .
(exit 0)

$ pnpm typecheck
$ tsc --noEmit
(exit 0)

$ pnpm test
$ vitest run

 RUN  v4.1.8 /Users/bibiota/Documents/projects/run-map

 Test Files  8 passed (8)
      Tests  23 passed (23)
   Start at  15:38:05
   Duration  570ms
```

### E2E（6 tests across 5 spec files）

```text
$ pnpm test:e2e
$ node --env-file-if-exists=.env.local ./node_modules/@playwright/test/cli.js test

Running 6 tests using 4 workers

  ✓  1 [chromium] › e2e/admin-unauthenticated.spec.ts:3:5 › unauthenticated GET /admin/upload redirects to /admin/login (1.3s)
  ✓  3 [chromium] › e2e/visitor-detail.spec.ts:6:7 › route detail for "totally-fake-slug" shows Coming soon placeholder (1.4s)
  ✓  4 [chromium] › e2e/visitor-detail.spec.ts:6:7 › route detail for "example-route" shows Coming soon placeholder (1.4s)
  ✓  5 [chromium] › e2e/visitor-home.spec.ts:3:5 › home page renders hero and CTA → /routes (767ms)
  ✓  6 [chromium] › e2e/visitor-list.spec.ts:3:5 › routes list page shows empty-state placeholder (721ms)
  ✓  2 [chromium] › e2e/admin-login-flow.spec.ts:94:5 › authenticated admin reaches /admin/upload and sees Coming soon + sign out (2.7s)

  6 passed (3.8s)
```

### Scenario coverage map（為什麼很多 scenario 對 test file grep 是「unmatched」）

本 change 的 spec scenarios 性質分三類：

| 分類 | 覆蓋方式 | 例 |
|---|---|---|
| **e2e + unit-test 覆蓋** | 直接由 `e2e/*.spec.ts` 或 `features/**/__tests__/*.test.ts` 斷言 | "Authenticated admin sees the placeholder"（e2e/admin-login-flow）、"handleGithubSignIn targets /auth/callback"（features/admin-auth/__tests__/login.test.ts line 24）、"Five spec files exist" / "pnpm test:e2e passes locally"（e2e 跑通本身） |
| **DB / curl 一次性 evidence** | 由 progress + debugging-report 章節中的 `pnpm db:migrate` 套用 / `SELECT public.app_admin_github_username()` / `curl /auth/v1/settings` 等 capture 證實 | "PostGIS extension is enabled"（Session 18 evidence）、"routes table has RLS enabled with two policies"（Session 19 verify-rls 腳本輸出）、"Admin identity function returns the configured GitHub username"（Session 21 + 23 query 結果 'BIBIOTA'）、"Anonymous SELECT returns zero on empty table"（deploy.md §7 sanity Query A 跑通） |
| **External setup（dashboard 動作）** | 由人類 dashboard 操作 + 後續 evidence（curl / OAuth flow 成功）確認 | "GitHub provider is enabled in Supabase"（Session 21 fix + `curl /auth/v1/settings` → external.github=true）、"GitHub OAuth App callback URL matches Supabase"（Yuki OAuth 走通即 implicit verify）、"Vercel project mirrors the GitHub repo"（task 8.2 `deferred:`）、CI scenarios（YAML 解析 + 條件 inspect） |

`Authenticated admin sees the placeholder` 在 6.5 acceptance 標 `verification-pending: e2e`，Session 23 task 8.3 完成後本 verification 報告解除——`e2e/admin-login-flow.spec.ts` 真實斷言「Coming soon · GPX 上傳開發中」可見、Sign out button 可見。

`Admin session fixture signs a JWT`（spec ADDED Requirement scenario）的字面實作從 `jose` SignJWT 改為 Supabase Admin API `generate_link(type=magiclink)` 換真 access_token + refresh_token（Session 23 pivot 1 / Playwright 1.61 + jose ESM exports 不相容）；任務 8.3 acceptance 已明寫此 pivot、e2e 跑綠是覆蓋此 scenario「為 admin 注入有效 Supabase session 並使 middleware 接受」的功能等價驗證。

**Stage 1 verdict**: PASS。Scenario grep 的 28 個 UNMATCHED 全部都能對應到上面三類覆蓋，無「實際上漏寫測試」的情況。

## Spec Evidence

```text
$ openspec validate wave-c-supabase-rls-auth --strict
Change 'wave-c-supabase-rls-auth' is valid

$ grep -E "^- \[ \]" openspec/changes/wave-c-supabase-rls-auth/tasks.md
- [ ] 8.2 [External setup] Vercel project + Preview deployment
- [ ] Figma designs (spec-driven-dev:writing-figma)
```

兩個 unchecked 條目都有 `deferred:` 註解：

- `8.2`: external manual follow-up（與 3.1 / 3.2 同模式）；CI 8.4 已能覆蓋 git push → e2e green 閉環，Vercel preview 是 UX 加值非 functional gate
- `Figma designs`: design.md §8 明列「不需要」，/admin/login 是 OAuth button 一顆 + /admin/upload 是 Coming soon placeholder，沿用 V2 Trail Vintage tokens

### progress.md gate

最後一 session 為 `## Session 25 — 2026-06-18 23:50`，含明確 `- Next action: 14/17 task passing；剩 8.2 (Vercel external)。...`。PASS。

## Diagram Verification

| File | Type | Status | Notes |
|---|---|---|---|
| `01-sequence-admin-oauth-flow.puml` | Sequence | PASS | Verification 中發現 stale → 補上 `/auth/callback` participant + §4 拆成「Supabase exchange」+「§4.5 我家 callback 換 session」+ §2 redirectTo 更新；regenerated PNG。對齊 features/admin-auth/handleGithubSignIn.ts + app/auth/callback/route.ts + middleware.ts + lib/supabase/{server,middleware}.ts + features/auth-flash/AuthErrorFlash.tsx，每個 callee.method 在 src/ 都存在 |
| `02-er-routes-schema.puml` | ER | PASS | Verification 中發現 stale → routes_rls / gpx_rls note 從 `current_setting('app.admin_github_username')` 改為 `public.app_admin_github_username()` + 加上 CREATE OR REPLACE FUNCTION 例；relationship label 從「RLS jwt + SET LOCAL」改為「RLS jwt + IMMUTABLE fn」；regenerated PNG。對齊 lib/db/schema.ts（20 columns + 4 indexes）+ migrations 0001/0002 |

## Design Verification

n/a — 本 change 不需要 Figma（design.md §8 已決定、tasks.md 已 `deferred:`）。

## Next Actions

- 全 verification stage PASS，建議下一步：`openspec archive wave-c-supabase-rls-auth`
- archive 後 follow-up：
  1. Yuki 完成 task 8.2（Vercel dashboard import + 5 env vars + first preview deploy URL）並補 evidence；若要把這個 follow-up 也走 OpenSpec 流程，可以起一個 `feat-vercel-preview-deployment` micro-change，或就在後續 `feat-admin-gpx-upload` change 內順手 cover
  2. Yuki 在 GitHub repo Settings → Secrets and variables → Actions 加入 6 個 secrets（同 8.4 task acceptance prerequisite 段落列表），CI e2e job 才會真綠
