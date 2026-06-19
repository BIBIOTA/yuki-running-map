---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

# Tasks: feat-admin-gpx-upload

> 22 個 tasks 分 5 個 group：
>
> - **1. Lib helpers**（4 tasks）— `lib/admin-routes/` 與 `lib/db/errors.ts`，純函式 + unit/integration tests
> - **2. Server Actions**（3 tasks）— `features/admin-routes/actions/{create,update,delete}Route.ts`，含 integration tests
> - **3. UI components**（8 tasks）— `features/admin-routes/*.tsx`
> - **4. Page & nav integration**（4 tasks）— `app/(admin)/admin/{upload,routes,routes/[id]}/page.tsx` + AdminTopNav 更新
> - **5. E2E**（3 tasks）— Playwright spec 改寫 + 新增
>
> 測試策略：unit / integration 測試一律與實作 task 同 PR（紅 → 綠 → refactor）；E2E 因為跨層整合，獨立成 Group 5。所有 dep 編號為「同檔 task 編號」。

## 1. Lib helpers

- [x] 1.1 Add `lib/admin-routes/validation.ts` with `validateRouteMetadata`
  - Acceptance: WHEN import `validateRouteMetadata` from `lib/admin-routes/validation` 並以合法 metadata 物件呼叫 THEN 回 `{ ok: true, value: RouteMetadataInput }` 且 `value` 內所有欄位通過 design.md §6.1 的規則（title trim、slug 通過 `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`、tags trim+dedup+上限 20、difficulty enum、duration 正整數、published boolean）；AND 對任一違規輸入 THEN 回 `{ ok: false, fieldErrors }` 且 `fieldErrors` 含對應欄位 key 與中文錯誤訊息；AND `lib/admin-routes/__tests__/validation.test.ts` 涵蓋每條規則正反面 ≥ 2 case；AND `pnpm test` 對 `lib/admin-routes/validation.ts` statement coverage ≥ 80%；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

- [x] 1.2 Add `lib/admin-routes/gpxFile.ts` with `validateGpxFile` + `derivePathFromUuid`
  - Acceptance: WHEN `validateGpxFile(file)` 收到副檔名非 `.gpx` 的 File THEN 回 `{ ok: false, message: '請選 .gpx 檔' }`；AND 收到 `size > 10 * 1024 * 1024` 的 File THEN 回 `{ ok: false, message: '檔案超過 10 MB' }`；AND 合法 File 回 `{ ok: true }`；AND `derivePathFromUuid(new Date('2026-06-19'), 'abc-123')` 回 `'gpx/2026/abc-123.gpx'`；AND `lib/admin-routes/__tests__/gpxFile.test.ts` 涵蓋三種 validate 結果與 path 格式；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

- [x] 1.3 Add `lib/admin-routes/listExistingTags.ts`
  - Acceptance: WHEN 對含多筆 routes（tags 重疊）的 Supabase 執行 `await listExistingTags(db)` THEN 回 `string[]` 且每個元素 distinct、長度 = union(unnest(tags))；AND 對空表執行 THEN 回 `[]`；AND `lib/admin-routes/__tests__/listExistingTags.integration.test.ts` 用 local Supabase + seed 涵蓋兩個情境；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: passing (static; integration execution VERIFICATION-PENDING)

- [x] 1.4 Add `lib/db/errors.ts` with `isPgUniqueViolation`
  - Acceptance: WHEN `isPgUniqueViolation(error, 'routes_slug_unique')` 收到 `postgres` 套件丟出的 unique violation error（code `23505`、constraint `routes_slug_unique`）THEN 回 true；AND 對 code 非 23505 或 constraint 不符的 error THEN 回 false；AND 對非 Error 物件（null / undefined / 字串）THEN 回 false；AND `lib/db/__tests__/errors.test.ts` 涵蓋三種情境；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

## 2. Server Actions

- [x] 2.1 Add `features/admin-routes/actions/createRoute.ts`
  - Acceptance: WHEN `createRoute(formData)` 收到含合法 `gpxFile` + 完整 metadata 的 FormData THEN server 端執行 `parseGpx(buffer)` → `supabase.storage.from('gpx').upload(path, buffer)` → `db.insert(routes).values(...)` → `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')` → 回 `{ ok: true, id, slug }`；AND 對 metadata 驗證失敗 THEN 不 upload、不 INSERT、回 `{ ok: false, fieldErrors }`；AND 對 server `parseGpx` throw（GPX 無 trackpoint）THEN 不 upload、回 `{ ok: false, fieldErrors: { gpxFile: 'GPX 解析失敗（無有效軌跡點？）' } }`；AND 對 Storage upload throw THEN 不 INSERT、回 `{ ok: false, fieldErrors: { _form: 'Storage 上傳失敗，請重試' } }`；AND 對 INSERT throw 因 slug UNIQUE 衝突 THEN 呼叫 `storage.remove([path])` rollback、回 `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`；AND 對其他 INSERT throw THEN rollback Storage、回 `{ ok: false, fieldErrors: { _form: '寫入失敗：...' } }` 且 `console.error`；AND `features/admin-routes/actions/__tests__/createRoute.integration.test.ts` 用 local Supabase + fixture sample.gpx 涵蓋上述五條路徑；AND `pnpm typecheck` exit 0
  - Depends on: 1.1, 1.2, 1.4
  - Independence: serial
  - status: passing (static; integration execution VERIFICATION-PENDING; malformed-tags boundary test runs locally)

- [x] 2.2 Add `features/admin-routes/actions/updateRoute.ts`
  - Acceptance: WHEN `updateRoute({ id, ...meta })` 收到合法 metadata THEN Action 先 `SELECT slug FROM routes WHERE id=$1` 取得 `oldSlug` → `db.update(routes).set({...metaOnly, updated_at: now()}).where(eq(routes.id, id))` 執行成功 → `revalidatePath('/routes')` + `revalidatePath('/routes/' + oldSlug)` + `revalidatePath('/routes/' + newSlug)`（若兩者不同）+ `revalidatePath('/admin/routes')` → 回 `{ ok: true }`；AND Action 內 strip 掉 client 試圖送來的 `gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `recorded_at` / `id` / `created_at`；AND 驗證失敗 THEN 不 UPDATE、回 `{ ok: false, fieldErrors }`；AND slug UNIQUE 衝突 THEN 回 `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`；AND 其他 throw THEN 回 `{ ok: false, fieldErrors: { _form: '寫入失敗：...' } }` 且 `console.error`；AND `features/admin-routes/actions/__tests__/updateRoute.integration.test.ts` 涵蓋 happy path / slug 衝突 / 鎖死欄被 strip 三個情境；AND `pnpm typecheck` exit 0
  - Depends on: 1.1, 1.4
  - Independence: serial
  - status: passing (static; integration execution VERIFICATION-PENDING; non-gated locked-key + validation-fail tests run locally)

- [ ] 2.3 Add `features/admin-routes/actions/deleteRoute.ts`
  - Acceptance: WHEN `deleteRoute({ id })` 收到存在 route 的 id THEN 先 `SELECT gpx_path FROM routes WHERE id = $1` → `DELETE FROM routes WHERE id = $1` → `supabase.storage.from('gpx').remove([gpx_path])` → `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')` → 回 `{ ok: true }`；AND SELECT 0 rows（不存在的 id）THEN 直接回 `{ ok: true }`（idempotent）；AND Storage `remove` throw THEN row 已刪、回 `{ ok: true }` 且 `console.warn('orphan gpx file', path, e)`；AND DB DELETE throw THEN 回 `{ ok: false, message: '刪除失敗' }`；AND `features/admin-routes/actions/__tests__/deleteRoute.integration.test.ts` 涵蓋存在 / 不存在 / Storage remove 失敗三條路徑；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: serial
  - status: in_progress

## 3. UI components

- [ ] 3.1 Add `features/admin-routes/TagsInput.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<TagsInput value={[]} onChange={fn} existingTags={['河濱','LSD']} />` THEN 顯示輸入框 + 空 chip 區；AND 輸入 `河濱` 後按 Enter 或 `,` THEN 觸發 `onChange(['河濱'])` 且輸入框清空 chip 出現；AND 輸入時下方顯示 `existingTags` typeahead 建議；AND 點 chip 上 × 按鈕 THEN 觸發 `onChange([])`；AND 同字串重複輸入 THEN 不重複加入 chip；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.2 Add `features/admin-routes/GpxDropzone.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<GpxDropzone onFile={fn} />` THEN 顯示 drop area 含「拖放 GPX 或點擊選擇」copy；AND drop 或選擇副檔名 `.gpx` 且 ≤ 10 MB 的 File THEN 呼叫 `onFile(file, parsedMetadata)`，`parsedMetadata` 為 client `parseGpx(buffer)` 結果；AND drop 非 `.gpx` THEN 顯示 inline 紅字「請選 .gpx 檔」且不觸發 `onFile`；AND drop > 10 MB THEN 顯示「檔案超過 10 MB」；AND client `parseGpx` throw THEN 顯示「無法解析此 GPX」且不觸發 `onFile`；AND 用 `lib/admin-routes/gpxFile.ts` 與 `lib/gpx/parseGpx`；AND `pnpm typecheck` exit 0
  - Depends on: 1.2
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.3 Add `features/admin-routes/RouteMapPreview.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<RouteMapPreview geojson={feature} bbox={[...]} />` THEN 用 `lib/map/createMap` 初始 MapLibre 載入 PMTiles 基圖；AND 加入 GeoJSON `LineString` source + line layer（顏色 `--color-route-line`）；AND 呼叫 `map.fitBounds([sw, ne], { padding: 32 })`；AND component unmount THEN 呼叫 `map.remove()` 清理；AND 不接受空 geojson（render null）；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.4 Add `features/admin-routes/RouteMetadataForm.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<RouteMetadataForm mode="create" existingTags={...} onSubmit={fn} />` THEN 顯示欄位 title / slug / description / region / tags / difficulty / duration_s / published；AND tags 欄位渲染 `<TagsInput>`；AND submit 觸發 `onSubmit(values)`，submit 中 `<button>` disabled 直到 promise resolve；AND `mode="edit"` + `initial={route}` THEN 欄位 prefill；AND 收到 `fieldErrors` prop THEN 對應欄位下方顯示紅字；AND `_form` key 在表單頂部顯示 Alert 條；AND 不渲染 GPX 衍生欄位（distance / elevation / bbox / start_point / recorded_at / gpx_path）；AND `pnpm typecheck` exit 0
  - Depends on: 3.1
  - Independence: serial
  - status: not_started

- [ ] 3.5 Add `features/admin-routes/DeleteRouteButton.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<DeleteRouteButton id={...} title={...} />` THEN 顯示「刪除」Button；AND 點按 THEN 開啟 Radix `AlertDialog` body 含「將永久刪除 {title}（含 GPX 原檔）」；AND Dialog 內按「確認刪除」呼叫 `deleteRoute({ id })` Server Action；AND Action 回 `{ ok: true }` THEN 關閉 Dialog 並由 router 重整列表 + sonner toast「已刪除 {title}」；AND Action 回 `{ ok: false, message }` THEN Dialog 保留並顯示錯誤訊息；AND `pnpm typecheck` exit 0
  - Depends on: 2.3
  - Independence: serial
  - status: not_started

- [ ] 3.6 Add `features/admin-routes/RouteList.tsx` (Server Component)
  - Acceptance: WHEN 從 Server Component 呼叫 `<RouteList routes={routes} />` THEN 渲染 shadcn Table 含欄：title / slug / region / published / recorded_at / actions；AND `published=false` 的 row 視覺上以「草稿」chip 標示；AND actions 欄含「編輯」連結（→ `/admin/routes/${id}`）與 `<DeleteRouteButton>`；AND 空 routes THEN 顯示「尚無路線，請至 /admin/upload 新增」CTA；AND `pnpm typecheck` exit 0
  - Depends on: 3.5
  - Independence: serial
  - status: not_started

- [ ] 3.7 Add `features/admin-routes/UploadPageClient.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<UploadPageClient existingTags={...} />` THEN 初始顯示 `<GpxDropzone>`；AND 收到 dropzone `onFile(file, parsed)` 後 THEN 渲染 `<RouteMapPreview geojson={parsed.geojson} bbox={parsed.bbox} />` 與 `<RouteMetadataForm mode="create" existingTags={...} onSubmit={...} />`；AND form `onSubmit` 透過 `useTransition` 呼叫 `createRoute(formData)`，`formData.append('gpxFile', file)`；AND `createRoute` 回 `{ ok: true, slug }` THEN `router.push('/admin/routes')` + sonner toast「已新增 {title}」 含「檢視」連結（指向 `/routes/${slug}`，僅 published=true 時可點）；AND 回 `{ ok: false, fieldErrors }` THEN 傳給 `<RouteMetadataForm>` 渲染錯誤；AND `pnpm typecheck` exit 0
  - Depends on: 2.1, 3.2, 3.3, 3.4
  - Independence: serial
  - status: not_started

- [ ] 3.8 Add `features/admin-routes/EditPageClient.tsx` (Client Component)
  - Acceptance: WHEN 渲染 `<EditPageClient initial={route} existingTags={...} />` THEN 渲染 `<RouteMetadataForm mode="edit" initial={route} existingTags={...} onSubmit={...} />`；AND form `onSubmit` 透過 `useTransition` 呼叫 `updateRoute({ id: initial.id, ...values })`；AND 回 `{ ok: true }` THEN stay on page + sonner toast「已儲存」；AND 回 `{ ok: false, fieldErrors }` THEN 傳給 form 渲染錯誤；AND `pnpm typecheck` exit 0
  - Depends on: 2.2, 3.4
  - Independence: serial
  - status: not_started

## 4. Page & nav integration

- [ ] 4.1 Rewrite `app/(admin)/admin/upload/page.tsx`
  - Acceptance: WHEN admin GET `/admin/upload` THEN HTTP 200；AND SSR 內呼叫 `listExistingTags(db)` 取得 tags 並傳入 `<UploadPageClient existingTags={...} />`；AND 既有 placeholder「Coming soon · GPX 上傳開發中」與 sign-out 已被取代；AND 未登入或非 admin GET 同路徑 THEN 仍被 middleware 守住（依賴 Wave C 4.1 中介層）；AND `pnpm typecheck` exit 0
  - Depends on: 1.3, 3.7
  - Independence: serial
  - status: not_started

- [ ] 4.2 Add `app/(admin)/admin/routes/page.tsx`
  - Acceptance: WHEN admin GET `/admin/routes` THEN HTTP 200；AND SSR 內 `db.select().from(routes).orderBy(desc(routes.created_at))` 取全部 routes（admin RLS 看得到草稿）；AND 渲染 `<RouteList routes={...} />`；AND 未登入或非 admin 被 middleware 擋；AND `pnpm typecheck` exit 0
  - Depends on: 3.6
  - Independence: serial
  - status: not_started

- [ ] 4.3 Add `app/(admin)/admin/routes/[id]/page.tsx`
  - Acceptance: WHEN admin GET `/admin/routes/{id}` 對應到存在 route THEN HTTP 200；AND SSR 內以 `db.select().from(routes).where(eq(routes.id, id)).limit(1)` 取得 route，並呼叫 `listExistingTags(db)`；AND 渲染 `<EditPageClient initial={route} existingTags={...} />`；AND id 對應 0 rows THEN 呼叫 `notFound()` 回 404；AND 未登入或非 admin 被 middleware 擋；AND `pnpm typecheck` exit 0
  - Depends on: 1.3, 3.8
  - Independence: serial
  - status: not_started

- [ ] 4.4 Update `features/admin-auth/AdminTopNav.tsx`
  - Acceptance: WHEN admin 在 `/admin/*` 任一頁 THEN top-nav 顯示「上傳 (/admin/upload)」與「路線管理 (/admin/routes)」兩個連結；AND 當前 pathname 對應的連結以 active 樣式凸顯；AND 既有 sign-out 行為不變；AND `pnpm typecheck` exit 0
  - Depends on: -
  - Independence: parallel-safe
  - status: not_started

## 5. E2E (Playwright)

- [ ] 5.1 Rewrite `e2e/admin-upload.spec.ts`
  - Acceptance: WHEN 此 spec 跑 `pnpm test:e2e` THEN admin（OAuth mock fixture）登入 → 訪 `/admin/upload` → drop `e2e/fixtures/sample.gpx` → 預期看到 map preview 容器與 metadata 卡片內距離 / 爬升等數字 → 填 title `E2E Route` / slug `e2e-route` / difficulty `easy` / published true → 按「儲存」→ 預期跳 `/admin/routes` 且列表出現該 row + sonner toast「已新增」可見；AND `beforeEach` truncate `routes` 表與 `storage.objects` (bucket `gpx`)；AND 既有「Coming soon」斷言移除
  - Depends on: 4.1, 4.2
  - Independence: serial
  - status: not_started

- [ ] 5.2 Add `e2e/admin-route-edit.spec.ts`
  - Acceptance: WHEN 此 spec 跑 THEN seed 一筆 route 後 admin 登入 → 訪 `/admin/routes` → 點該 row「編輯」連結 → 預期到 `/admin/routes/{id}` → 改 title 與 tags → 按「儲存」→ 預期 sonner toast「已儲存」且仍在同頁、欄位顯示新值；AND 重新整理後欄位仍顯示新值（DB 真實寫入）；AND `beforeEach` truncate
  - Depends on: 4.2, 4.3
  - Independence: serial
  - status: not_started

- [ ] 5.3 Add `e2e/admin-route-delete.spec.ts`
  - Acceptance: WHEN 此 spec 跑 THEN seed 一筆 route 後 admin 登入 → 訪 `/admin/routes` → 點該 row「刪除」→ 預期 Radix AlertDialog 出現 → 點「確認刪除」→ 預期 dialog 關閉、列表少一條、sonner toast「已刪除」可見；AND DB 中該 row 已不存在（用 admin client 查詢驗證）；AND Storage 中對應 `gpx_path` 物件不存在；AND `beforeEach` truncate
  - Depends on: 4.2
  - Independence: serial
  - status: not_started

## Optional artifacts
- [x] PlantUML diagrams:
  - [01-sequence-create-route.puml](./diagrams/01-sequence-create-route.puml)
  - [02-sequence-delete-route.puml](./diagrams/02-sequence-delete-route.puml)
  - [03-activity-action-result-handling.puml](./diagrams/03-activity-action-result-handling.puml)
- [x] Figma designs (spec-driven-dev:writing-figma) — required scope: wireframes for /admin/upload + /admin/routes + /admin/routes/[id] + dropzone states
