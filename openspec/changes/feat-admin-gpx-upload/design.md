---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

# Design: feat-admin-gpx-upload

## 1. Why

Wave C 結束時，`/admin/upload` 仍是 `placeholder-pages` capability 內的 "Coming soon" 殼。本 change 將 admin GPX 上傳實作起來，並把 admin routes 的編輯與刪除一併納入，讓 Yuki 可以完整地用 UI 管理 `routes` 表。

此 change 完成後：

- `/admin/upload`：drag-drop GPX → client 預覽（地圖 + metadata）→ 填表 → Server Action 上傳 + INSERT
- `/admin/routes`：列出所有 routes（含草稿與已發佈）含「編輯 / 刪除」操作
- `/admin/routes/[id]`：編輯既有 route 的 metadata（GPX 衍生欄位鎖死）
- 刪除路徑為硬刪除（routes row + `gpx` Storage 原檔一起清掉），確認 modal 防呆

Bootstrap `design.md` §5.4 已先以概念形式描繪上傳流程；本 change 是該段的具體實作 + 範圍擴張為完整 admin CRUD。

## 2. Scope

### In

- 新增 `/admin/routes` 列表頁
- 新增 `/admin/routes/[id]` 編輯頁
- 改寫 `/admin/upload` placeholder 為實際上傳表單
- 新增三個 Server Action：`createRoute` / `updateRoute` / `deleteRoute`
- 新增共用元件：`<RouteMetadataForm>`、`<TagsInput>`、`<GpxDropzone>`、`<RouteMapPreview>`、`<DeleteRouteButton>`
- 新增 `lib/admin-routes/{validation,gpxFile,listExistingTags}.ts`
- Admin top-nav 增加 `/admin/routes` 連結
- Unit + integration + e2e 測試覆蓋
- 改寫既有 `e2e/admin-upload.spec.ts` 為「實際上傳成功」測試

### Out

- `cover_image` 欄位（永遠寫 null；下個 change 處理）
- GPX 的「重新上傳取代」功能（編輯頁鎖 GPX）
- 任何 soft-delete / 還原 / 回收筒
- `routes` 表 schema 變動（新增欄位 / 索引）
- 公開頁面（`/routes`、`/routes/[slug]`）的真實實作（仍是 placeholder；下個 change `feat-route-list-query` 與 `feat-route-detail-page`）
- 任何新增 npm dependency（驗證走 hand-rolled）
- 公開頁面對「未發佈 route」的處理（仍由 `anon_read_published` RLS 隱藏）

## 3. Architecture

### 3.1 Route 結構

```
app/(admin)/admin/
  ├─ login/page.tsx        # 既有：GitHub OAuth (Wave C)，不動
  ├─ upload/page.tsx       # 改寫：placeholder → 真實上傳表單
  └─ routes/               # 新增
      ├─ page.tsx          # SSR 列出所有 routes
      └─ [id]/page.tsx     # SSR 載入單筆 + 渲染編輯表單
```

`/admin/login` 的 OAuth `redirectTo` 仍指向 `<origin>/admin/upload`，保留 `placeholder-pages` 既有契約；Yuki 登入後可從 admin top-nav 切換到 `/admin/routes`。

### 3.2 Runtime split

| Surface | Runtime | 原因 |
|---|---|---|
| `/admin/upload`、`/admin/routes`、`/admin/routes/[id]` SSR 頁殼 | Node | 與 Server Action 同 runtime；SSR 內可呼叫 `lib/supabase/server.ts` |
| `<GpxDropzone>` / `<RouteMapPreview>` / `<RouteMetadataForm>` / `<TagsInput>` / `<DeleteRouteButton>` | Browser | drag-drop、client `parseGpx` 預覽、MapLibre、Radix Dialog |
| Server Actions (`createRoute` / `updateRoute` / `deleteRoute`) | Node | `parseGpx` 用 `Buffer` + Supabase Storage SDK |
| middleware admin guard | Edge | 沿用 Wave C；matcher 已 cover `/admin/:path*` |

### 3.3 Trust boundary

- Client 端的 `parseGpx` 僅作預覽 UX；其輸出不跨 Server Action boundary
- Server Action 收到 `FormData` 內的 GPX `File` 後 **必須** server 端重新 `parseGpx(buffer)`，所有 `routes` 表的 GPX 衍生欄位（`distance_m` / `elevation_gain_m` / `bbox` / `start_point` / `geojson` / `recorded_at` / `duration_s`）來源唯一是 server-side parse 結果
- Metadata 欄位（`title` / `slug` / `description` / `region` / `tags` / `difficulty` / `published`）由 client 提供，Server Action 經 `validateRouteMetadata` 把關後寫入

### 3.4 RLS 角色

寫入 `routes` 表與 `gpx` bucket 全部走 Wave C 已建立的 policies：

- `routes` 表：`admin_full_access` (FOR ALL, USING `auth.jwt()->'user_metadata'->>'user_name' = public.app_admin_github_username()`)
- `storage.objects` (`gpx` bucket)：`gpx_admin_write` / `gpx_admin_modify` / `gpx_admin_delete`

Server Action 用 `lib/supabase/server.ts` 的 `createServerClient`（讀 cookie 拿 admin JWT），**不使用** `SUPABASE_SERVICE_ROLE_KEY` — RLS 才是真實的 server-side 閘門。Middleware 守 page 層；Action 仍受 RLS 雙重保護。

## 4. Components & Files

### 4.1 新增 UI 元件 (`features/admin-routes/`)

| File | Kind | 職責 |
|---|---|---|
| `RouteList.tsx` | Server | SSR 撈所有 routes（admin RLS 看得到草稿），渲染表格與每列「編輯 / 刪除」按鈕 |
| `DeleteRouteButton.tsx` | Client | Radix `AlertDialog` 確認 → 呼叫 `deleteRoute` → toast |
| `RouteMetadataForm.tsx` | Client | 共用表單欄位；受 `mode: 'create' \| 'edit'` 控制；submit handler 由父元件注入 |
| `TagsInput.tsx` | Client | Chips + creatable typeahead；接受 `existingTags: string[]` |
| `GpxDropzone.tsx` | Client | drag-drop / file input；副檔名 + ≤ 10 MB 檢查；client `parseGpx` |
| `RouteMapPreview.tsx` | Client | `lib/map/createMap` 渲 PMTiles 基圖 + GPX polyline overlay + `fitBounds(bbox)` |
| `UploadPageClient.tsx` | Client | 組合 `GpxDropzone` + `RouteMapPreview` + `RouteMetadataForm` (create) |
| `EditPageClient.tsx` | Client | 包 `RouteMetadataForm` (edit) + 傳入初始值 |

### 4.2 新增 Server Actions (`features/admin-routes/actions/`)

每個檔案頂部 `"use server"`，Node runtime。

| File | 行為 |
|---|---|
| `createRoute.ts` | 驗證 → server `parseGpx` → Storage upload → INSERT → `revalidatePath` → 回 `{ ok: true, id, slug } \| { ok: false, fieldErrors }` |
| `updateRoute.ts` | 驗證（僅 metadata）→ UPDATE → `revalidatePath` → 回 `{ ok: true } \| { ok: false, fieldErrors }` |
| `deleteRoute.ts` | SELECT `gpx_path` → DELETE row → Storage `remove([path])`（best-effort）→ `revalidatePath` → 回 `{ ok: true } \| { ok: false, message }` |

### 4.3 新增共用程式碼 (`lib/admin-routes/`)

| File | 職責 |
|---|---|
| `validation.ts` | `validateRouteMetadata(input: unknown)` 回 discriminated union `{ ok:true,value } \| { ok:false,fieldErrors }`；hand-rolled, no new dep |
| `listExistingTags.ts` | Drizzle `SELECT DISTINCT unnest(tags) FROM routes` helper；SSR 用 |
| `gpxFile.ts` | `validateGpxFile(file: File)` (副檔名 + size)；`derivePathFromUuid(date: Date, uuid: string)` → `gpx/{yyyy}/{uuid}.gpx` |

### 4.4 改寫既有檔案

| File | 變更 |
|---|---|
| `app/(admin)/admin/upload/page.tsx` | placeholder → SSR 呼叫 `listExistingTags()` + 渲染 `<UploadPageClient existingTags={...} />` |
| `app/(admin)/admin/routes/page.tsx` | **新增** SSR 撈 routes + 渲染 `<RouteList />` |
| `app/(admin)/admin/routes/[id]/page.tsx` | **新增** SSR 載入單筆 + tags + 渲染 `<EditPageClient initial={route} />` |
| `features/admin-auth/AdminTopNav.tsx` | 增加 `/admin/routes` 連結 |

### 4.5 不動的東西

- `lib/gpx/*` — 已可直接重用 `parseGpx`
- `lib/db/schema.ts` — 無 schema 變動
- `lib/supabase/*` — `createServerClient` / `createBrowserClient` 沿用
- `middleware.ts` — matcher 已 cover `/admin/:path*`
- `app/auth/callback/route.ts` — OAuth callback 不動
- `/admin/login` 的 `redirectTo`

## 5. Data flow

### 5.1 Create

1. Yuki → `/admin/upload`：SSR `listExistingTags()` 預載 → 回 HTML
2. drag-drop `foo.gpx` → `<GpxDropzone>` 驗副檔名 + size → client `parseGpx` → `<RouteMapPreview>` 渲圖 → `<RouteMetadataForm>` 顯現
3. Yuki 填表單按「儲存」→ POST Server Action `createRoute(FormData)`
4. Action：
   1. `validateRouteMetadata(formData)` — fail 回 `fieldErrors`
   2. 讀 `gpxFile` → `Buffer`
   3. server-side `parseGpx(buffer)` — throw 則回 `fieldErrors.gpxFile`
   4. `uuid = randomUUID()`、`path = 'gpx/' + yyyy + '/' + uuid + '.gpx'`
   5. `supabase.storage.from('gpx').upload(path, buffer)` — fail 回 `fieldErrors._form`
   6. `db.insert(routes).values({...parsed, ...meta, gpx_path: path})` — catch 內 `storage.remove([path])` 回 rollback；若 slug UNIQUE 衝突回 `fieldErrors.slug`
   7. `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')`
   8. 回 `{ ok: true, id, slug }`
5. Client：redirect `/admin/routes` + sonner toast「已新增 ${title}」

### 5.2 Update (metadata only)

1. Yuki → `/admin/routes/[id]`：SSR 撈 route + `listExistingTags()` → 渲 `<EditPageClient initial={route} />`
2. Yuki 改幾欄按「儲存」→ POST Server Action `updateRoute({ id, ...meta })`
3. Action：
   1. `validateRouteMetadata` — fail 回 `fieldErrors`
   2. `db.update(routes).set({...metaOnly, updated_at: now()}).where(eq(routes.id, id))`
   3. 若 slug UNIQUE 衝突回 `fieldErrors.slug`
   4. `revalidatePath('/routes')` + `revalidatePath('/routes/' + oldSlug)` + `revalidatePath('/routes/' + newSlug)` + `revalidatePath('/admin/routes')`
   5. 回 `{ ok: true }`
4. Client：stay on edit page + toast「已儲存」

**鎖死欄位**：`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `recorded_at` / `id` / `created_at`。Edit form 連欄位都不渲染，且 Action 內 strip 掉任何 client 試圖送來的這些 key。

### 5.3 Delete

1. Yuki 在 `/admin/routes` 列表按某 row「刪除」→ `<DeleteRouteButton>` 打開 Radix `AlertDialog`
2. Dialog 內容：「將永久刪除 {title}（含 GPX 原檔）」+「取消 / 確認刪除」
3. Yuki 按確認 → POST Server Action `deleteRoute({ id })`
4. Action：
   1. `SELECT gpx_path FROM routes WHERE id = $1`；若 0 rows 回 `{ ok: true }`（idempotent）
   2. `DELETE FROM routes WHERE id = $1`
   3. `supabase.storage.from('gpx').remove([gpx_path])` — best-effort；失敗 `console.warn('orphan gpx file', path, e)` 並仍回 `ok: true`
   4. `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')`
   5. 回 `{ ok: true }`
5. Client：redirect `/admin/routes` + toast「已刪除 {title}」

**順序**：row 先刪 → Storage 後 remove。因為 `gpx_public_select_published` policy 條件是 `EXISTS (SELECT 1 FROM routes WHERE gpx_path = ... AND published = true)`；row 一旦刪掉，policy 條件即失效，剩下的 orphan Storage 物件對 anon 已不可讀，即使 Storage remove 還沒成功也安全。

## 6. Validation & Error handling

### 6.1 `validateRouteMetadata` 規則

| Field | Rule |
|---|---|
| `title` | required, trim 後長度 ≥ 1, ≤ 200 |
| `slug` | required, regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, ≤ 80 |
| `description` | optional, ≤ 5000 |
| `region` | optional, ≤ 50 |
| `tags` | array, 每元素 trim → 去重 → 過濾空字串；上限 20 個；每個 ≤ 30 字 |
| `difficulty` | required, enum `{ easy, medium, hard }` |
| `duration_s` | optional, 正整數 |
| `published` | required boolean |

### 6.2 失敗來源 → UX 對應

| 失敗發生點 | UX |
|---|---|
| Client：副檔名 / size / `parseGpx` throw | `<GpxDropzone>` inline 紅字；「儲存」按鈕 disabled 直到換檔 |
| Client：必填空 / `useTransition` pending | submit 按鈕 disabled |
| Server `validateRouteMetadata` fail | 對應欄位下方紅字（從 `fieldErrors[field]` 取） |
| Server `parseGpx` fail | `fieldErrors.gpxFile = 'GPX 解析失敗（無有效軌跡點？）'` |
| Server Storage upload fail | `fieldErrors._form = 'Storage 上傳失敗，請重試'`（無 orphan） |
| Server INSERT fail：`23505` on `routes_slug_unique` | rollback Storage → `fieldErrors.slug = '此 slug 已被使用'` |
| Server INSERT fail：其他 | rollback Storage → `fieldErrors._form = '寫入失敗：${e.message ?? "未知錯誤"}'`；同時 `console.error(e)` |
| Update：slug UNIQUE 衝突 | `fieldErrors.slug` 同 create |
| Update：其他 throw | `fieldErrors._form = '寫入失敗：…'` + `console.error` |
| Delete：row 不存在 | 回 `{ ok: true }`（idempotent） |
| Delete：Storage remove 失敗 | row 已刪 → 回 `{ ok: true }` + `console.warn` |
| Session 過期 / 非 admin | RLS 拒寫 → 同 Storage / INSERT fail 對應路徑 |

`_form` key 規範：對應整張表單的錯誤，UI 在表單頂端顯示 Alert + sonner toast。

### 6.3 Action 回傳契約

每個 Action 一律回 union，避免 throw 跨 client boundary：

```ts
// createRoute
type CreateRouteResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; fieldErrors: Record<string, string> }

// updateRoute
type UpdateRouteResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> }

// deleteRoute
type DeleteRouteResult =
  | { ok: true }
  | { ok: false; message: string }
```

Client 用 `useTransition` + 自管 state，不依賴 Next.js `useFormState`（避免 React canary API 變動風險）。

## 7. Testing

按 AGENTS.md 三層分工。

### 7.1 Unit (Vitest)

| Target | File | 覆蓋 |
|---|---|---|
| `validateRouteMetadata` | `lib/admin-routes/__tests__/validation.test.ts` | 每條規則正反面：title trim、slug regex（含 `--`、開頭結尾 `-`、大寫拒絕）、tags trim / dedup / 上限、difficulty enum、duration 正整數、published boolean、缺欄位 |
| `validateGpxFile` + `derivePathFromUuid` | `lib/admin-routes/__tests__/gpxFile.test.ts` | 副檔名、size、path 格式 |
| `isPgUniqueViolation` | `lib/db/__tests__/errors.test.ts` | `postgres` error shape match constraint name |

Coverage 目標：`lib/admin-routes/validation.ts` ≥ 80% statement。

### 7.2 Integration (Vitest + Local Supabase)

| Target | File | 覆蓋 |
|---|---|---|
| `createRoute` | `features/admin-routes/actions/__tests__/createRoute.integration.test.ts` | (1) happy path：投 sample.gpx + 完整 metadata → Storage 有檔、routes 有 row、`revalidatePath` 被呼叫（mock）。(2) slug 衝突 → Storage 清空、回 `fieldErrors.slug`。(3) GPX 無 trackpoint → 不上傳、回 `fieldErrors.gpxFile`。(4) 不帶 admin jwt → Storage RLS 拒絕。 |
| `updateRoute` | `.../updateRoute.integration.test.ts` | (1) 改 metadata 成功。(2) slug 衝突。(3) client 試圖送 `gpx_path` 等鎖死欄 → Action strip 掉。 |
| `deleteRoute` | `.../deleteRoute.integration.test.ts` | (1) 存在的 row → routes 與 Storage 都消失。(2) 不存在 id → ok。(3) Storage remove mock fail → row 已刪、回 ok、log warn。 |
| `listExistingTags` | `lib/admin-routes/__tests__/listExistingTags.integration.test.ts` | 多筆 routes 含重疊 tags → distinct 結果 |

Integration tests 前置 seed admin user + 1–2 條 sample routes；測完 truncate；沿用 Wave C 既有 fixtures 模式。

### 7.3 E2E (Playwright)

**改寫** `e2e/admin-upload.spec.ts`：
- 原：admin 登入 → `/admin/upload` → 「Coming soon · GPX 上傳開發中」
- 改：admin 登入 → `/admin/upload` → drop fixture sample.gpx → 看到 map preview + metadata 卡 → 填表 → 按儲存 → 跳 `/admin/routes` 看到剛新增 row + toast

**新增** 兩支 spec：
- `e2e/admin-route-edit.spec.ts`：admin 登入 → `/admin/routes` → 點 row 編輯 → 改 title + tags → 儲存 → toast + 欄位是新值
- `e2e/admin-route-delete.spec.ts`：admin 登入 → `/admin/routes` → 按 row 刪除 → confirm dialog → 確認 → 列表少一條 + toast

**不動**：其他 4 個既有 spec。

**Fixture**：沿用 `lib/gpx/__fixtures__/sample.gpx`（複製或共用至 `e2e/fixtures/`）；admin JWT mock 沿用 Wave C；`beforeEach` truncate `routes` + `storage.objects` (bucket `gpx`)。

### 7.4 CI

`.github/workflows/ci.yml` 已含 lint / typecheck / test / e2e。本 change 不動 CI 結構，新增測試自動納入既有 job。

## 8. Risks

| Risk | 對應 |
|---|---|
| Storage upload 成功但 INSERT 失敗 → orphan GPX 檔 | createRoute catch 內 `storage.remove([path])` rollback；integration test 涵蓋 slug 衝突路徑驗證清空 |
| Delete 順序錯，先 remove Storage 後 DELETE row 中間 anon 可讀到 404 GPX | 設計上強制 DELETE row → Storage remove；orphan 容忍但 RLS 已隱藏 path |
| Slug 改名後舊路徑被 ISR 快取住 | updateRoute 同時 `revalidatePath('/routes/' + oldSlug)` + `revalidatePath('/routes/' + newSlug)` |
| client 偽造送 `gpx_path` 等鎖死欄 → 覆寫 Storage 對應 | Action 內 strip；integration test 涵蓋 |
| GPX > 10 MB 仍上送 → Vercel function body limit | Client + server 雙重 size 檢查；超過 10 MB Server Action 直接 reject |
| Session 在編輯中過期 → 看似成功實際 RLS 拒絕 | RLS 拒寫 → 走 `fieldErrors._form` 路徑顯示「寫入失敗」+ 引導 Yuki 重新登入 |
| 雙擊 submit | `useTransition` pending state，button disabled；createRoute 不額外 idempotency token（personal site 接受微低機率重複） |
| Yuki 誤刪 | Confirm dialog；無還原機制（personal site 接受） |
| Wave C `/admin/upload` placeholder-pages spec requirement 與本 change 直接衝突 | `proposal.md` 將 `placeholder-pages` 的 `/admin/upload` requirement 標為 REMOVED；新 capability `admin-routes-crud` 包含取而代之的 requirement |

## 9. Probable next steps

按 spec-driven-dev 工序：

1. **`writing-uml`**：3 張圖（createRoute sequence、deleteRoute sequence、create/update/delete Action result-handling activity diagram）
2. **`writing-figma`**：3 個 admin 頁的 wireframe + dropzone empty / loaded / error 狀態
3. **`writing-spec`**：產 proposal.md + 對應 capability spec（預計拆出新 capability `admin-routes-crud`；同時 MODIFY `placeholder-pages` 將 `/admin/upload` requirement REMOVE）
4. **`subagent-driven-development`** 或 **`test-driven-development`**：實作
5. **`verification-before-completion`**
