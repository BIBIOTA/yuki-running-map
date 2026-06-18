---
change_id: wave-c-supabase-rls-auth
doc_language: 繁體中文
---

# Design: Wave C — Supabase + RLS + Auth

> 本 change 承接 `bootstrap-yuki-running-map`（已 archive 2026-06-16）verification report §Next Actions 列出的 11 個 deferred tasks。bootstrap 故意把所有需要外部服務（Supabase / GitHub OAuth / Vercel）的工作切出來，這個 change 把它們一次落地，但**不**包含真實 GPX upload 或 route 列表 / detail 的 DB 接通——那些留給更後續的功能 change。

## 1. 目的與範圍

### 目的

讓 admin 能用 GitHub OAuth 真實登入、middleware 真擋未授權者、routes table + RLS + `gpx` Storage bucket 全部建好（即使表內 0 筆 row）、Vercel preview deployment 通、Playwright 5 條 spec 在 CI 跑綠。完成後，整個資料管線的「auth + persistence 骨架」就到位，後續功能 change 只要寫 server action + UI 就能 demo。

### In scope（11 tasks，沿用 bootstrap 編號）

| Group | Task | 描述 |
|---|---|---|
| **DB & Storage** | 3.1 | Supabase project + PostGIS extension + `gpx` Storage bucket（public） |
| | 3.2 | Supabase Auth GitHub OAuth provider 設定 |
| | 3.3 | Drizzle schema for `routes` table（對齊 `docs/data-model.md`） |
| | 3.4 | Drizzle migration with 4 個 PostGIS / btree / GIN indexes |
| | 3.5 | RLS policies on `routes` + `gpx` bucket |
| | 3.6 | Supabase client helpers（`lib/supabase/browser.ts` / `server.ts` / `middleware.ts`） |
| **Auth surface** | 4.1 | `middleware.ts` admin guard |
| | 6.4 | `/admin/login` — GitHub OAuth button（真能登入） |
| | 6.5 | `/admin/upload` — Coming soon placeholder（受 middleware 保護） |
| **CI & deploy** | 8.2 | Vercel project + Preview Deployment |
| | 8.3 | Playwright smoke tests for 5 routes（含 OAuth mock） |

### Out of scope（推到後續 change）

- **真實 GPX upload 邏輯**：form / server action / parse → DB 寫入 / storage upload — 留給 `feat-admin-gpx-upload`
- **`/routes` 列表接 DB**：仍維持 placeholder「目前無路線」（無 seed 資料）
- **`/routes/[slug]` 真實渲染**：map / 海拔曲線 / GPX 下載按鈕 — 留給 `feat-route-detail-page`
- **地圖框選搜尋**：PostGIS `ST_Intersects` 查詢 — 留給 `feat-map-viewport-search`
- **`profiles` table / RBAC**：admin = single env var match，不引入 roles
- **forgot-password / email signup**：純 GitHub OAuth-only
- **visual regression / 跨瀏覽器 / mobile viewport**：E2E 只跑 chromium desktop

### 成功條件

1. `pnpm db:migrate` 對乾淨 Supabase 跑通，產出 `routes` table、4 個 index、2 條 RLS policy、`gpx` bucket policy
2. middleware：未登入 `/admin/upload` → 302 → `/admin/login`
3. 以 `ADMIN_GITHUB_USERNAME` GitHub user 登入 → 進 `/admin/upload` 看到「Coming soon」placeholder
4. 以非 admin GitHub user 登入 → redirect `/` + flash「您不是 admin」
5. 5 個 Playwright spec 全部 pass on local + CI（含 OAuth mock spec）
6. PR merge 到 main → Vercel production deploy 成功

---

## 2. External setup prerequisites

Change 內 SDD/TDD 進行之前，Yuki 必須完成下列**外部設定**（已記於 `docs/runbooks/deploy.md`）。tasks.md 對應的 task 會明確標 `prerequisite: external-setup`，未完成時 status 維持 `blocked`。

1. **Supabase 專案** 建立、enable `postgis` extension、建立 `gpx` Storage bucket（public）
2. **Supabase Auth → Providers → GitHub** 填 client_id / secret；對應的 GitHub OAuth App 的 callback URL = `https://<supabase-ref>.supabase.co/auth/v1/callback`
3. **Vercel 專案** import GitHub repo + 5 個 env vars（`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_GITHUB_USERNAME` / `NEXT_PUBLIC_PMTILES_URL`）

---

## 3. DB & Storage 設計

### Drizzle schema (`lib/db/schema.ts`)

對齊 `docs/data-model.md` §`routes` table。要點：

```ts
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  distanceM: integer("distance_m").notNull(),
  elevationGainM: integer("elevation_gain_m").notNull(),
  durationS: integer("duration_s"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  locationName: text("location_name"),
  region: text("region"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  difficulty: difficultyEnum("difficulty").notNull(),
  gpxPath: text("gpx_path").notNull(),
  geojson: jsonb("geojson").notNull(),
  bbox: bboxColumn().notNull(),         // PostGIS geometry(Polygon,4326) via customType
  startPoint: pointColumn().notNull(),  // PostGIS geometry(Point,4326)   via customType
  coverImage: text("cover_image"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

PostGIS 欄位 Drizzle 沒原生支援 → 在 `lib/db/postgis.ts` 用 `customType` 封裝；migration SQL 內手寫 `geometry(Polygon, 4326)` / `geometry(Point, 4326)`。

### Migration tooling

- `drizzle-kit generate` → SQL 進 `lib/db/migrations/`（commit 進 git）
- `drizzle-kit migrate` apply 到 Supabase；`pnpm db:migrate` script 對應這個指令
- PostGIS extension、GIST / GIN indexes、RLS policies、Storage bucket policies → 手動寫在 migration SQL 內（generator 處理不了）

### Indexes（4 個）

```sql
CREATE INDEX routes_bbox_gist        ON routes USING GIST(bbox);
CREATE INDEX routes_start_point_gist ON routes USING GIST(start_point);
CREATE INDEX routes_recorded_at_desc ON routes (recorded_at DESC);
CREATE INDEX routes_tags_gin         ON routes USING GIN(tags);
```

### RLS policies

```sql
-- Admin identity 由 SQL function 提供（migration CREATE OR REPLACE 設定值）
CREATE OR REPLACE FUNCTION public.app_admin_github_username()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 'bibiota'::text $$;

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Anon SELECT: 只能看 published
CREATE POLICY anon_read_published ON routes
  FOR SELECT
  USING (published = true);

-- Admin: 全表 CRUD
CREATE POLICY admin_full_access ON routes
  FOR ALL
  USING (
    (auth.jwt()->'user_metadata'->>'user_name')
    = public.app_admin_github_username()
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'user_name')
    = public.app_admin_github_username()
  );
```

`public.app_admin_github_username()` 是 **migration 寫死**的 SQL function（`IMMUTABLE` 讓 planner inline 進 policy expression）。改 admin = 起一支 follow-up migration `CREATE OR REPLACE FUNCTION ... RETURN '<new-user>'`（個人專案可接受）。若 jwt 不含 `user_name`（未登入 anon）則比對結果 NULL，policy 拒絕——fallback 為「無人是 admin」（fail-closed）。

> **設計取捨（兩次 pivot）**：
> 1. 原 design 想用 per-request `SET LOCAL app.admin_github_username = ...`，但 Supabase JS client 走 PostgREST connection pool，無法 per-request SET LOCAL。
> 2. 改為 `ALTER DATABASE postgres SET app.admin_github_username = ...` cluster-level GUC，但 Supabase **managed `postgres` role 沒權限**改 cluster-level custom parameters（`permission denied to set parameter "app.admin_github_username"`）。
> 3. 最終改為 SQL function `public.app_admin_github_username()`，policy `current_setting(...)` → `public.app_admin_github_username()`。優點：migration 內自洽、不依賴 cluster setting、`IMMUTABLE` 讓 planner inline；代價：admin username 與 `ADMIN_GITHUB_USERNAME` env 需保持手動同步（兩個獨立的事實源），改 admin 要起 follow-up migration。

### `gpx` bucket（public + conditional SELECT）

```sql
-- Public read 但只對 published row 的 gpx_path 放行
CREATE POLICY gpx_public_select_published ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'gpx'
    AND EXISTS (
      SELECT 1 FROM routes
      WHERE gpx_path = storage.objects.name
        AND published = true
    )
  );

-- Admin write
CREATE POLICY gpx_admin_write ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'gpx'
    AND (auth.jwt()->'user_metadata'->>'user_name')
        = public.app_admin_github_username()
  );

CREATE POLICY gpx_admin_modify ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'gpx'
    AND (auth.jwt()->'user_metadata'->>'user_name')
        = public.app_admin_github_username()
  );

CREATE POLICY gpx_admin_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'gpx'
    AND (auth.jwt()->'user_metadata'->>'user_name')
        = public.app_admin_github_username()
  );
```

> **與 bootstrap data-model.md 不同**：bootstrap 寫「Public read disabled, signed URL only」。本 change 改為「bucket public + policy 限 published」。`docs/data-model.md` §Storage RLS 與 §`gpx_path` 描述需要同步更新（task §6 列入文件更新清單）。

### `lib/supabase/` 三個 factories

| 檔案 | 用途 | 重點 |
|---|---|---|
| `browser.ts` | "use client" component 用 | `createBrowserClient` from `@supabase/ssr` |
| `server.ts` | Server Component / Server Action | `createServerClient` 包 `@supabase/ssr` + `next/headers` cookies；無需手動灌入 admin identity（policy 用 `public.app_admin_github_username()`） |
| `middleware.ts` | Edge middleware 用 | session refresh helper、cookie 雙向寫 |

---

## 4. Auth + Middleware + Admin pages

### Auth flow

```
訪客點 /admin/login
  → 顯示「以 GitHub 登入」Button
  → supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: <origin>/admin/upload }
    })
  → 跳轉 github.com OAuth consent
  → GitHub callback → supabase.co/auth/v1/callback → 換 session cookie
  → 回 /admin/upload，cookie 已存在
  → middleware 攔截：
       - 抓 session
       - 比對 jwt.user_metadata.user_name vs ADMIN_GITHUB_USERNAME
       - 相符 → 放行
       - 不符 → supabase.auth.signOut() + redirect("/?auth_error=not_admin")
       - 無 session → redirect("/admin/login")
```

### middleware.ts（Edge runtime）

```ts
export const config = { matcher: ["/admin/:path*"] };

export async function middleware(req: NextRequest) {
  // /admin/login 自身 bypass guard
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const adminUsername = process.env.ADMIN_GITHUB_USERNAME;
  const githubUsername = user.user_metadata?.user_name;

  if (githubUsername !== adminUsername) {
    await supabase.auth.signOut();
    const url = new URL("/", req.url);
    url.searchParams.set("auth_error", "not_admin");
    return NextResponse.redirect(url);
  }

  return res;
}
```

### Admin pages

| Route | middleware 保護？ | 內容 |
|---|---|---|
| `/admin/login` | ❌ bypass | shadcn Card + 「以 GitHub 登入」Button（Client Component；call `supabase.auth.signInWithOAuth`） |
| `/admin/upload` | ✅ | 「Coming soon · GPX 上傳開發中」+ Sign out 按鈕（call `supabase.auth.signOut()` → `/`） |

`app/(admin)/layout.tsx` 上方 nav 含 sign-out；login 頁特例不顯示 nav（pathname === `/admin/login` 時直接 render children）。

### `/` flash 訊息

`/` 接收 `?auth_error=not_admin` 時，用 sonner（已安裝）跳一次性 toast「您不是 admin，已登出」。Toast 顯示後在 client 清掉 query param（`router.replace('/')`）。

---

## 5. CI & E2E

### Vercel preview (task 8.2)

- Vercel dashboard → Import GitHub repo → build command `pnpm build` / install command `pnpm install`
- 5 個 env vars 在 Vercel Project Settings 一次設好；Preview 與 Production 共用 Supabase（個人專案不分環境）
- PR 開啟 → Vercel 自動 deploy preview → comment 顯示 preview URL
- merge to main → auto deploy production

### Playwright E2E (task 8.3)

**安裝**：`pnpm add -D @playwright/test`，`pnpm exec playwright install --with-deps chromium`

**5 條 spec**：

| # | Spec | 路徑 | 驗證 |
|---|---|---|---|
| 1 | `visitor-home.spec.ts` | `/` | 200 + `<h1>Yuki's Running Map</h1>` + CTA → `/routes` 可點 |
| 2 | `visitor-list.spec.ts` | `/routes` | 200 + 「目前無路線」empty state |
| 3 | `visitor-detail.spec.ts` | `/routes/example-route` & `/routes/totally-fake-slug` | 200 + Coming soon（行為一致） |
| 4 | `admin-unauthenticated.spec.ts` | `/admin/upload` 未登入 | redirect 到 `/admin/login` |
| 5 | `admin-login-flow.spec.ts` | OAuth mock → `/admin/upload` | 看到「Coming soon」+ sign-out |

### OAuth mock 策略（spec 5）

主方案：Playwright fixture 用 `jose` + **`SUPABASE_JWT_SECRET`** sign 一個合法 JWT（HS256），把 Supabase session cookie inject 進 context，跳過 github.com redirect。`SUPABASE_JWT_SECRET` 從 Supabase Dashboard → Settings → API → JWT Settings 取得，**E2E-only**（不放到 `.env.example`，只放 CI secrets 與 Yuki local）。

```ts
// e2e/fixtures/admin-session.ts
import { test as base } from "@playwright/test";
import { SignJWT } from "jose";

export const test = base.extend({
  adminPage: async ({ page, context }, use) => {
    const jwt = await new SignJWT({
      sub: "test-admin-uuid",
      user_metadata: { user_name: process.env.ADMIN_GITHUB_USERNAME },
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));

    await context.addCookies([{
      name: `sb-${supabaseRef}-auth-token`,
      value: JSON.stringify({ access_token: jwt, /* ... */ }),
      domain: "localhost",
      path: "/",
    }]);
    await use(page);
  },
});
```

**替代方案**（若 `jose` dep 不被接受、或 Supabase 升版破壞 cookie 格式）：在 Supabase 開一個 email/password 測試帳號，Playwright fixture 改用 `supabase.auth.signInWithPassword(...)` 取 session。需事先在 Supabase 後台手動建立該 user 並設 `user_metadata.user_name = ADMIN_GITHUB_USERNAME`。

**`jose` 新 dep**：~30KB dev-only；提案前需依 AGENTS.md「Don't introduce new deps without asking」流程確認；若被拒則切替代方案。

### GitHub Actions

新增 `e2e` job（附加在既有 `.github/workflows/ci.yml`）：

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: [lint, typecheck, test]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install --with-deps chromium
    - run: pnpm build
    - run: pnpm test:e2e
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        SUPABASE_JWT_SECRET: ${{ secrets.SUPABASE_JWT_SECRET }}   # E2E-only, used by spec 5 fixture
        ADMIN_GITHUB_USERNAME: bibiota
        NEXT_PUBLIC_PMTILES_URL: ${{ secrets.NEXT_PUBLIC_PMTILES_URL }}
```

`playwright.config.ts` 用 `webServer: { command: 'pnpm start', port: 3000 }`（測 prod build）。

`pnpm test:e2e` script 對應 `playwright test`。Fork PR 不跑 E2E（避免 secrets 洩漏）。

---

## 6. 文件更新清單

| 檔案 | 改什麼 |
|---|---|
| `docs/data-model.md` §RLS / §Storage RLS | 從「Public read disabled, signed URL」改為「bucket public + policy 限 published」；同步 SQL 範例 |
| `docs/data-model.md` §`gpx_path` 描述 | 「下載按鈕直接給 signed URL」改成「published row 直接給 public URL；草稿不公開」 |
| `docs/architecture.md` | 補上 Edge Middleware → Supabase Auth → Postgres `public.app_admin_github_username()` 流程圖（mermaid） |
| `docs/runbooks/deploy.md` | 新增「OAuth callback 驗證步驟」+「RLS 手動測試 SQL」 |
| `docs/runbooks/local-dev.md` | 新增「啟動本地 supabase（或共用 dev project）」+「`pnpm db:migrate` 流程」 |
| `CLAUDE.md` 常用指令表 | `pnpm db:migrate`、`pnpm test:e2e` 從「Wave B/C」更新為「可用」 |

---

## 7. Risks

| Risk | 對應 |
|---|---|
| Supabase RLS 寫錯導致 admin 也存不到 | migration 後跑驗證 SQL：admin session → `SELECT count(*) FROM routes` 應成功；無 session → 0 row。記入 task acceptance |
| `public.app_admin_github_username()` 與 `ADMIN_GITHUB_USERNAME` env 不同步 | 兩個獨立的事實源（policy 比對 vs middleware 比對），改 admin 要同時改 follow-up migration 與 Vercel env。`docs/runbooks/deploy.md` 第 5 步與 RLS sanity SQL 章節記錄此手動步驟 |
| GitHub OAuth callback URL 設錯 | `docs/runbooks/deploy.md` 增加「測試 OAuth callback」驗證；callback 走 supabase.co、無需自架 |
| Supabase 自由方案 cold start latency | 個人專案可接受，不引入 keepalive |
| `jose` 新 dep | task acceptance 標「需取得新 dep approval」；若拒絕，切到 password-based test user 替代方案 |
| PostGIS column 在 Drizzle generate 不完整 | `customType` + hand-edit migration SQL；schema 與 migration 雙向 review；unit test 用 fixture parse → 寫入 → 讀出比對 |
| PostGIS bbox / start_point operations boilerplate | `lib/db/postgis.ts` 寫 helper 把 GeoJSON Polygon / Point 轉成 `ST_GeomFromGeoJSON(...)` SQL fragment |

---

## 8. Probable next steps

### 本 change 內必做

- **`spec-driven-dev:writing-uml`**: 兩張 diagram
  - **Sequence diagram**: admin OAuth flow（user → /admin/login → github → supabase callback → middleware check → /admin/upload）
  - **ER diagram**: `routes` table schema（補上 bootstrap deferred 的部分），含 indexes、RLS policy 註記
- **`spec-driven-dev:writing-figma`**: **不需要**。`/admin/login` 是 OAuth button 一顆；`/admin/upload` 是 Coming soon。沿用 V2 Trail Vintage tokens

### 後續 change 候選（**不**在本 change 範圍）

1. `feat-admin-gpx-upload`：真實 GPX 上傳（form / server action / parse / storage / DB 寫入）
2. `feat-route-detail-page`：`/routes/[slug]` 真實渲染（map / 海拔曲線 / GPX 下載按鈕）
3. `feat-route-list-query`：`/routes` 接 DB query + filter + sort
4. `feat-map-viewport-search`：地圖框選搜尋（`ST_Intersects`）

### Acceptance criteria 預覽（待 writing-plans 細化）

- `pnpm db:migrate` 對乾淨 Supabase 跑通；產生 routes table、4 個 index、2 條 RLS、`gpx` bucket 4 條 policy
- middleware: `/admin/upload` 未登入 → 302 → `/admin/login`
- admin GitHub user 登入 → 進 `/admin/upload` 看到「Coming soon」
- 非 admin GitHub user 登入 → redirect `/?auth_error=not_admin` + flash toast
- 5 個 Playwright spec 全 pass on local + CI
- Vercel preview 在 PR 自動建立、production deploy 綠燈

---

## Diagrams

- [Sequence: Admin OAuth Flow](./diagrams/01-sequence-admin-oauth-flow.puml) — 訪客點 `/admin/login` → GitHub OAuth → Supabase callback → middleware 比對 `ADMIN_GITHUB_USERNAME` 後分支放行或 sign-out + redirect `/?auth_error=not_admin`；對應 §4 Auth + Middleware + Admin pages。
- [ER: routes Table Schema](./diagrams/02-er-routes-schema.puml) — `routes` 完整欄位 + 4 個 indexes + 2 條 RLS policies；標示與 Storage `gpx` bucket 的 logical FK (`gpx_path → storage.objects.name`) 與 `auth.users` 的 admin identity gating；對應 §3 DB & Storage。
