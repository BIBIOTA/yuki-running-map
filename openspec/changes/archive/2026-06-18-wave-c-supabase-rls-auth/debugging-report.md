---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

# Debugging Report: wave-c-supabase-rls-auth

Date: 2026-06-18
Debugger: claude-opus-4-7 (session 21)

## Symptom

- **Reported behavior**：Yuki 在瀏覽器 GET `https://kuvawzutnqgeqabrmeke.supabase.co/auth/v1/authorize?provider=github&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fadmin%2Fupload&code_challenge=...&code_challenge_method=s256`，得到 HTTP 400 + body：

  ```json
  {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
  ```

- **Expected behavior**：依 design.md §4 Auth flow，該 URL 應 302 redirect 到 GitHub OAuth consent page（`https://github.com/login/oauth/authorize?client_id=...`）。
- **Impact**：
  - Yuki 無法在本機完成 GitHub OAuth 登入 → `auth.users` 維持 0 row
  - 連帶 E2E spec 5 `admin-login-flow.spec.ts` 無法綠燈（fixture 找不到 admin user → 拋 "No auth.users row with user_metadata.user_name='bibiota'"）
  - Task 3.2「Supabase Auth GitHub OAuth provider」實際上未 passing；之前 Session 18 + Session 20 把它標 passing 是**錯誤**狀態同步——Yuki 在 Supabase Dashboard 填了 client_id / client_secret 但**沒按 Enable toggle**（或 toggle 沒生效）。

## Reproduction

- **Status**：reproduced（confirmed via curl）
- **Steps**：

  ```bash
  curl -i "https://kuvawzutnqgeqabrmeke.supabase.co/auth/v1/authorize?provider=github&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fadmin%2Fupload"
  # → HTTP/2 400, x-sb-error-code: validation_failed
  # → {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
  ```

- **Environment**：Supabase project `kuvawzutnqgeqabrmeke`（ap-northeast-1）、free tier
- **Test data / record IDs**：N/A（OAuth flow 在 user row 建立之前就被拒）

## Observation Plan

| Layer | Observation method | Evidence captured |
|---|---|---|
| Browser/UI | Yuki click `/admin/login` → 「以 GitHub 登入」button → 跳轉 supabase.co/auth/v1/authorize → 看到 JSON error | URL + status 400 JSON body 由 Yuki 提供 |
| API/backend (Supabase Auth) | `curl` direct hit `/auth/v1/authorize?provider=github` | HTTP/2 400 + `x-sb-error-code: validation_failed`（headers + body 全文已捕獲）|
| API/backend (GoTrue settings) | `curl ${SUPABASE_URL}/auth/v1/settings -H "apikey: ${ANON_KEY}"` | 全 `external.*` 為 false 除了 `email: true`；`"github": false`（決定性證據）|
| Database/persistence | `curl ${SUPABASE_URL}/auth/v1/admin/users` with service_role | `{"users":[]}`（如預期，OAuth 從沒成功過）|
| Background/async | N/A | — |
| Environment/build | `.env.local` 含 `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET` / `ADMIN_GITHUB_USERNAME=bibiota` | 全部存在（dev server 不會因 env 缺失 fallback redirect）|

## Evidence

### Repro curl（決定性）

```text
HTTP/2 400
content-type: application/json
sb-project-ref: kuvawzutnqgeqabrmeke
x-sb-error-code: validation_failed

{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

### GoTrue `/auth/v1/settings` snapshot（決定性根因）

```json
{
  "external": {
    "anonymous_users": false,
    "apple": false,
    "azure": false,
    "bitbucket": false,
    "discord": false,
    "facebook": false,
    "snapchat": false,
    "figma": false,
    "fly": false,
    "github": false,            // ← root cause
    "gitlab": false,
    "google": false,
    "keycloak": false,
    "kakao": false,
    "linkedin": false,
    "linkedin_oidc": false,
    "notion": false,
    "spotify": false,
    "slack": false,
    "slack_oidc": false,
    "workos": false,
    "twitch": false,
    "twitter": false,
    "email": true,
    "phone": false,
    "zoom": false
  },
  "disable_signup": false,
  "mailer_autoconfirm": false,
  "phone_autoconfirm": false,
  "sms_provider": "twilio",
  "saml_enabled": false,
  "passkeys_enabled": false
}
```

### auth.users 內容

```text
{"users":[],"aud":"authenticated"}
```

## Data Flow Trace

- **Symptom observed at**：Browser navigate to `supabase.co/auth/v1/authorize?provider=github` → HTTP 400 JSON
- **First incorrect state found at**：GoTrue config `external.github = false`
- **Boundary where expected became actual**：Supabase Dashboard → Authentication → Providers → GitHub。Yuki 在 Session 18 進入該頁、填入 client_id / client_secret，但**沒按 Enable toggle**（或按了但沒 Save）。dashboard 表單儲存與 enable toggle 是兩個獨立動作；只填 client_id / client_secret 不會 enable provider。

## Working Reference

- 參考：`/auth/v1/settings` 的 `"email": true` 顯示 email provider **已**啟用——同個 GoTrue config 路徑、Supabase Dashboard 預設啟用 email 路徑工作正常。差異只在 dashboard toggle 狀態。
- 重要差異：email provider 是 Supabase 預設 enabled；github provider 需 dashboard 手動 toggle。

## Hypothesis

我認為 root cause 是 **Supabase Dashboard → Authentication → Providers → GitHub 的 Enable toggle 沒被打開**，因為：

- `curl /auth/v1/settings` 直接回 `"github": false`，這是 GoTrue 對 OAuth provider 啟用狀態的權威來源
- 此 endpoint 與「OAuth flow 拒絕請求」是同一份 config，故 toggle off → flow reject 為單因果

唯一變數確定就是 toggle 狀態，不是 client_id 錯、不是 callback URL 錯、不是 secret 錯（這些都會在 toggle 打開後另起其他 error，不會在這一階段擋下）。

## Next Action

- **Route to**：External setup（task 3.2）需重做：Yuki 回 Supabase Dashboard → Authentication → Providers → GitHub：
  1. 確認 client_id / client_secret 還在
  2. **把 Enable toggle 打開**
  3. 點 **Save**
  4. 重新跑 `curl ${SUPABASE_URL}/auth/v1/settings -H "apikey: ${ANON_KEY}" | jq .external.github` → 應為 `true`
- **再 verify OAuth flow**：Yuki 在 `pnpm dev` 後 GET `/admin/login` → 點「以 GitHub 登入」→ 應 302 → github.com OAuth consent → 完成後 redirect 回 `/admin/upload`
- **後續 E2E**：spec 5 fixture 的 `findAdminUser()` 將找到 user row、JWT 簽出來、cookie 注入後 middleware getUser() 應通過

依 skill checklist 步驟 11，root cause 屬於「external setup 不完整」而非 spec / implementation bug。Route 為：

- **不**進入 `writing-spec`（spec 沒錯）
- **不**進入 `test-driven-development`（code 沒錯）
- **是**回到 tasks.md task 3.2「External setup」未完成；待 Yuki 完成 dashboard toggle 並驗證 `/auth/v1/settings` 後，再 resume 跑 `pnpm test:e2e`。

---

## Resolution log（debug 連環 3 個 root cause）

### Layer 1 — Supabase GitHub Provider toggle off
- Symptom: `validation_failed / Unsupported provider: provider is not enabled`
- Fix: Yuki dashboard → Authentication → Providers → GitHub → Enable toggle on + Save
- Verify: `curl /auth/v1/settings` → `external.github = true`

### Layer 2 — GitHub OAuth App client_id 填錯
- Symptom: 點登入後跳到 `https://github.com/login/oauth/authorize?client_id=yuki-running-map&...` 出現 GitHub 404
- Root cause: Yuki 把 OAuth App 的**名字** (`yuki-running-map`) 而非實際 client_id 字串貼進 Supabase Provider 設定。GitHub OAuth App 設定頁的 **Client ID** 欄位才是要複製的字串
- Fix: 重抓正確 client_id（GitHub OAuth App 設定頁上方 Client ID 欄）+ regenerate Client Secret 一起放回 Supabase；確認 callback URL = `https://kuvawzutnqgeqabrmeke.supabase.co/auth/v1/callback`

### Layer 3 — `ADMIN_GITHUB_USERNAME` case mismatch
- Symptom: OAuth 走完後被踢回 `/admin/login` 而非看到 `/admin/upload`
- Evidence: `auth.users[0].user_metadata.user_name = "BIBIOTA"`（大寫，GitHub 原樣回傳）但 `ADMIN_GITHUB_USERNAME=bibiota` 小寫；middleware `decideAdminGuard` 字串比對拒絕
- Fix:
  - `.env.local` `ADMIN_GITHUB_USERNAME=BIBIOTA`
  - `.env.example` 加上「must match exact case GitHub returns」註解
  - migration `0002_sync_admin_username_uppercase.sql` 重簽 `public.app_admin_github_username()` 回 `'BIBIOTA'`
- Verify: `SELECT public.app_admin_github_username()` → `'BIBIOTA'`

### Layer 4 — 缺 `/auth/callback` Route Handler（spec gap）
- Symptom: 改完 case 後 OAuth 完成仍被踢回 `/admin/login` 純 URL（不是 `/?auth_error=not_admin`）
- Root cause（spec / implementation gap）: `@supabase/ssr` 預設走 PKCE flow，OAuth 完成後 Supabase 帶 `?code=...` 回 `redirectTo`，需要 server-side `auth.exchangeCodeForSession(code)` 才會寫 session cookie。原 `handleGithubSignIn.redirectTo` 直接設成 `/admin/upload`，被 middleware 在 code exchange 之前 run、看不到 cookie，redirect 回 `/admin/login` → loop。原 design.md §4 流程「supabase.co/auth/v1/callback → 換 session cookie → 回 /admin/upload，cookie 已存在」是**錯**的——supabase.co domain 寫的 cookie 跨不了 domain
- Fix:
  - 新增 `app/auth/callback/route.ts`：GET handler 讀 `?code=&next=`、`supabase.auth.exchangeCodeForSession(code)`、成功 302 → `next`、失敗 302 → `/admin/login?error=...`
  - `features/admin-auth/handleGithubSignIn.ts`: `redirectTo: ${origin}/auth/callback?next=/admin/upload`
  - design.md §4 + specs/data-and-auth-infrastructure/spec.md 新增 Requirement「`/auth/callback` exchanges PKCE code for a session」
- Verify: Yuki 走 OAuth → 看到 `/admin/upload` 的 Coming soon
- Route 修正: Layer 4 屬於 **spec / implementation gap** → 已經 update spec + implement，與 system-debugging skill checklist 步驟 11 的 `writing-spec` 路徑一致

### E2E 收尾（task 8.3）

- spec 5 `admin-login-flow.spec.ts` 改用 Supabase admin API `generate_link(type=magiclink)` 換真 access_token + refresh_token，將真 token 包成 base64-prefix JSON session cookie → middleware getUser 接受 → render
- 全 6 e2e test pass on local（5 spec 檔；visitor-detail.spec.ts 跑 2 slug）
