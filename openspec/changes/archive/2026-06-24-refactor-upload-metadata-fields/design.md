---
change_id: refactor-upload-metadata-fields
doc_language: zh-TW
---

# refactor-upload-metadata-fields — Design

## 1. 問題陳述（Why）

目前的 `/admin/upload` 預覽流程跟「上傳後看到的成品」不一致：

1. **沒有坡度圖**：`parseGpx()` 解析結果已含 `elevationProfile`（≤ 300 點 distance/elevation pairs），但 `UploadPageClient` 只把它一路餵給 server action，**沒有**在 client 端渲染。
2. **沒有縣市鄉鎮**：`route_admin_units` 是在 `createRoute` server action 內由 PostGIS `ST_Intersects` 算出來，整段 server-only；使用者在送出前看不到「這條路線會被歸到哪幾個縣市」。
3. **多了一個用不到的欄位**：表單上的「標籤」`TagsInput`、`routes.tags text[]` 欄位、`routes_tags_gin` 索引、`validation` 規則與 `existingTags` 通道全部仍在運作，但實際使用流程不再需要。

→ 上傳體驗與 detail 頁脫節；schema 帶著未使用的欄位與索引。

## 2. Scope（What）

本變更同時處理三件事：

| 動作 | 範圍 |
| --- | --- |
| **加** | `<ElevationProfile>` 出現在上傳預覽與 edit 頁。 |
| **加** | `<RouteRegions>` 出現在上傳預覽（送出**前**），透過新的 read-only Server Action `previewRegions(geojson)`。 |
| **拆** | `routes.tags` schema 欄位、`routes_tags_gin` 索引、`TagsInput` 元件、`tags.ts` 純函式、validation rule、`listExistingTags`、所有相關 unit / integration / E2E 測試。 |

公共 `/routes` / `/routes/[slug]` 頁不展示 tags chip（探勘時確認），但仍要在實作階段二次掃過確保沒有殘留。

不在 scope 內：
- 把 admin_units 邊界資料推到 client 做離線判斷（拒絕方案 A）
- 任何 V2 Trail Vintage token 重新洗牌
- 新增 React testing library / jsdom

## 3. 推薦方案 vs 替代方案

### 推薦：把「上傳預覽」當成一條獨立的 read-only data pipeline

- 在 `features/admin-routes/actions/previewRegions.ts` 新增一個薄薄的 Server Action：吃 `LineString` GeoJSON、共用 `lib/admin-routes/detectRegions`、回 `Region[]`。
- 上傳預覽複用既有的純展示元件（`<ElevationProfile>`、`<RouteRegions>`）— 預覽與成品零視覺差距。
- Tags 拆除走獨立 schema migration，與 1、2 解耦。

**為什麼推薦**：
- 預覽路徑不寫 DB、可獨立測試。
- 共用 `detectRegions` helper：預覽看到什麼 = create-time 寫入什麼（除非 admin_units 在 RPC 期間被改）。
- 只新增 1 個 RPC，最小化耦合。

### 替代方案 A — Client 端用 Turf.js 做 `ST_Intersects`

**拒絕**：需要把 admin_units 的 MultiPolygon（台灣全境 county + township）載進 client，bundle 體積會炸開；且必須在 client 重新實作 PostGIS 邏輯，與 server 邏輯雙頭真值。

### 替代方案 B — 送出後在 toast 標題加「已收錄 N 個區域」

**拒絕**：無法滿足「上傳頁面顯示縣市鄉鎮」的需求描述；使用者送出前仍看不到歸屬結果。

## 4. 架構

```
UploadPageClient (Client)
├─ phase: 'empty' | 'loaded' { file, geojson, bbox, elevationProfile, regionsState }
├─ GpxDropzone                ← 不變
├─ ── 右欄 / 下方 ──
│   ├─ RouteMapPreview        ← 不變
│   ├─ ★ ElevationProfile     ← 新增：直接吃 phase.elevationProfile
│   ├─ ★ RouteRegions slot    ← 新增：依 regionsState 顯示 loading / regions / error
│   └─ RouteMetadataForm      ← 移除 TagsInput、tags 欄位、existingTags prop

新 server action:
  features/admin-routes/actions/previewRegions.ts (`"use server"`)
    - Input:  GeoJSON LineString (client-derived from parseGpx)
    - Output: { ok: true; regions: Region[] } | { ok: false; message }
    - 共用 lib/admin-routes/detectRegions + adminUnits 一次 SELECT
    - 沒有寫入；沒有 revalidatePath；無 mutation
    - middleware.ts 守衛 /admin 區段已是 admin-only

schema migration:
  lib/db/migrations/0009_drop_routes_tags.sql
    DROP INDEX routes_tags_gin;
    ALTER TABLE routes DROP COLUMN tags;
```

## 5. 元件職責

### 不動
- `RouteMapPreview` / `GpxDropzone` / `RouteRegions` / `ElevationProfile`
- `features/route-detail/elevationProfileView.ts`（純 SVG view-math）

### 修改
| 檔案 | 修改 |
| --- | --- |
| `features/admin-routes/UploadPageClient.tsx` | `Phase.loaded` 多帶 `elevationProfile`、`regionsState`；在地圖預覽下方掛 `<ElevationProfile>` 與 `<RouteRegions>` slot；`handleFile` 結尾觸發 `previewRegions`。 |
| `features/admin-routes/RouteMetadataForm.tsx` | 移除「標籤」`<Field>` 與 `<TagsInput>`；移除 `existingTags` prop。 |
| `features/admin-routes/types.ts` | `RouteMetadataValues` 移除 `tags`。 |
| `features/admin-routes/routeMetadataFormState.ts` | 移除 `tags: []` 初值。 |
| `features/admin-routes/uploadPageState.ts` | `buildCreateRouteFormData` 不再 `append("tags", …)`。 |
| `features/admin-routes/editPageState.ts` | 移除 tags 通道。 |
| `features/admin-routes/EditPageClient.tsx` | 移除 `existingTags` prop；在 RouteMapPreview 下方掛 `<ElevationProfile profile={route.elevationProfile} />`。 |
| `features/admin-routes/actions/createRoute.ts` | 移除 tags parse / validate / INSERT。 |
| `features/admin-routes/actions/updateRoute.ts` | `ACCEPTED_FIELDS` 移除 `"tags"`；移除 tags 寫入。 |
| `lib/admin-routes/validation.ts` | 移除 tags 規則與 `RouteMetadataInput.tags`。 |
| `lib/db/schema.ts` | `routes` 移除 `tags` 與 `routes_tags_gin` index。 |
| `app/(admin)/admin/upload/page.tsx` | 移除 `listExistingTags` 呼叫與 prop。 |
| `app/(admin)/admin/routes/[id]/page.tsx` | 同上：移除 listExistingTags、existingTags prop。 |

### 新增
| 檔案 | 內容 |
| --- | --- |
| `features/admin-routes/actions/previewRegions.ts` | `"use server"` Server Action，純讀。 |
| `lib/db/migrations/0009_drop_routes_tags.sql` | `DROP INDEX routes_tags_gin; ALTER TABLE routes DROP COLUMN tags;` |

### 刪除
- `features/admin-routes/TagsInput.tsx`
- `features/admin-routes/tags.ts`
- `features/admin-routes/__tests__/tags.test.ts`
- `lib/admin-routes/listExistingTags.ts`（已確認存在；含 `__tests__/listExistingTags.integration.test.ts`，一併刪除）
- 對應 unit / integration / E2E 測試中的 tags 案例

## 6. 資料流

### 上傳：empty → loaded → submit

```
[1] 使用者拖入 GPX
    GpxDropzone → parseGpxFile() → GpxMetadata
    UploadPageClient.handleFile(file, parsed)
       └→ setPhase({ kind: 'loaded',
                     file, geojson, bbox,
                     elevationProfile: parsed.elevationProfile,
                     regionsState: { kind: 'loading' } })

[2] 立刻發 preview RPC（不阻塞地圖 / 坡度圖渲染）
    previewRegions(geojson) → Server Action
       ├─ ok    → setPhase(prev => { ...prev, regionsState: { kind: 'ready', regions } })
       └─ error → setPhase(prev => { ...prev, regionsState: { kind: 'error', message } })

[3] 預覽區塊：
    RouteMapPreview        ← geojson + bbox
    ElevationProfile       ← elevationProfile
    RouteRegions slot      ← regionsState (loading / ready / error)
    RouteMetadataForm      ← 不再有 tags

[4] 使用者按「儲存」
    handleSubmit(values) → buildCreateRouteFormData(values, file)
       ├─ 不再 append tags
       └─ append: title, slug, description, published, gpxFile
    createRoute(formData) → 不變的 parse → upload → INSERT → detectRegions → join INSERT → revalidate
    成功 → toast → router.push('/admin/routes')
```

### 編輯：edit 頁載入

```
loadRoute(id) → routes.elevationProfile（已存 DB）+ regions（leftJoin）
EditPageClient
  ├─ RouteMapPreview      ← geojson
  ├─ ElevationProfile     ← route.elevationProfile（新增）
  └─ RouteMetadataForm    ← 不再有 tags；routeRegions 由 server 給
```

edit 頁**不**呼叫 `previewRegions`：admin_units 寫入是 create-time 不可變，現有 leftJoin 就是真值來源。

### `regionsState` 三態（discriminated union）

```ts
type RegionsState =
  | { kind: 'loading' }
  | { kind: 'ready'; regions: Region[] }
  | { kind: 'error'; message: string };
```

對應 UI：
- `loading` → skeleton / 「正在判斷區域…」
- `ready` & regions.length > 0 → `<RouteRegions regions={...} />`
- `ready` & regions.length === 0 → 灰字「此路線未涵蓋任何已知行政區」
- `error` → 灰底訊息「無法預覽區域：{message}」+ 仍允許送出

## 7. 錯誤處理

### `previewRegions` Server Action（送出前）

| 來源 | 表現 | UI 反應 |
| --- | --- | --- |
| 參數 shape 錯誤（非合法 LineString） | `{ ok: false, message: '預覽參數錯誤' }` | regionsState = `error`。**不阻擋送出**。 |
| `detectRegions` 拋例外（DB / PostGIS） | `{ ok: false, message: '行政區預覽暫時無法使用' }`；server log 完整錯誤 | regionsState = `error`。送出仍可進行。 |
| 找到 0 個 admin_unit | `{ ok: true, regions: [] }` | regionsState = `ready`，顯示「此路線未涵蓋任何已知行政區」。 |
| 非 admin（middleware 已擋，加保險） | Throw → Action 收為 `error` | 等同 DB 錯誤 UI。 |

**規則**：preview 失敗永遠不擋使用者；create-time 的 `detectRegions` 才是 source of truth。

### `parseGpx` Client 端
- 既有 `GpxDropzone` 解析失敗 UI 不變。
- `elevationProfile.length === 0`（GPX 無 `<ele>`）由既有的 `[data-testid="elevation-empty"]` 空態接住，無新增分支。

### `createRoute` Server Action
- 移除 tags parse / validate / fieldErrors / INSERT；**其餘錯誤路徑全部不變**（storage rollback、slug unique、`行政區判斷失敗` 分支照舊）。

### Schema migration 風險
- `DROP COLUMN tags`：不可逆。Release 前 dump 備份（runbook 註記）。
- 先 `DROP INDEX routes_tags_gin` 再 `DROP COLUMN tags`，避免 PG dependency 警告。
- 沒有外鍵指到 tags，不會有 cascade 副作用。

## 8. 測試策略

### 單元測試（vitest, node）

| 檔案 | 涵蓋 |
| --- | --- |
| `features/admin-routes/__tests__/uploadPageState.test.ts` | `buildCreateRouteFormData` 不再 append `tags`；keys 僅 `title / slug / description / published / gpxFile`。 |
| `features/admin-routes/__tests__/routeMetadataFormState.test.ts` | `buildInitialValues` 不再有 `tags`。 |
| `features/admin-routes/__tests__/editPageState.test.ts` | `buildEditFormValues` / payload 移除 tags。 |
| `features/admin-routes/__tests__/tags.test.ts` | **刪除**。 |
| `lib/admin-routes/__tests__/validation.test.ts` | 移除 tags 規則案例。 |
| `lib/admin-routes/__tests__/previewRegions.test.ts`（新增） | shape 錯誤 → ok:false；detectRegions throw → ok:false；正常 → 正確 Region[]。 |

### Integration 測試（vitest, node, pg）

| 檔案 | 涵蓋 |
| --- | --- |
| `features/admin-routes/actions/__tests__/createRoute.integration.test.ts` | 移除 tags assertion；確認 INSERT columns 沒有 tags；確認 `routes_tags_gin` 不在 schema。 |
| `features/admin-routes/actions/__tests__/updateRoute.integration.test.ts` | tags 不在 ACCEPTED_FIELDS。 |
| `lib/admin-routes/__tests__/listExistingTags.integration.test.ts` | **刪除**。 |

### E2E（Playwright, chromium）

| 檔案 | 涵蓋 |
| --- | --- |
| `e2e/admin-upload.spec.ts` | 刪除「填標籤」步驟；新增三個斷言：(1) 拖入 GPX 後可見 `[data-testid="elevation-profile"]` 或 `[data-testid="elevation-empty"]`；(2) 可見 `[data-testid="upload-regions-state"]`，由 `loading` → `ready`；(3) 「儲存」後 routes 列表頁可見預覽時同一組區域 chips。 |
| `e2e/admin-route-edit.spec.ts` | 新增斷言：edit 頁可見 ElevationProfile；表單無「標籤」label。 |
| `e2e/public-route-detail.spec.ts` | 不變。 |
| 既有 tags 相關 E2E 案例 | **刪除**。 |

### 取捨
- `vitest + node`，無 jsdom / React testing library（CLAUDE.md「no new deps」），所有 React DOM 行為交給 Playwright。
- preview Server Action 的 admin gate 依賴 middleware；單元測試不重新驗證 middleware，由 E2E 用已登入 admin fixture 覆蓋。
- migration 不寫 vitest，靠 `pnpm db:migrate` + integration test 跑在乾淨 schema 上驗證。

## 9. 觀測指標

- `previewRegions` Server Action 在 `createServerClient` 之前以 `performance.now()` 圍住，失敗時 `console.error`；成功不記日誌（避免 noisy admin flow）。
- `regionsState = 'error'` 在 UI 顯示後不重試；使用者重新拖檔即重來。

## 10. Probable next steps

依步驟 9 的探詢：

- **UML**：不走 `spec-driven-dev:writing-uml`。三態 state machine 直接在本 design 第 6 節以 discriminated union 寫清楚；`previewRegions` 與 `createRoute` 的 sequence 在第 6 節以 ASCII 流程圖呈現，不另出 `.puml`。
- **Figma**：走 `spec-driven-dev:writing-figma`。需要產出兩組 frame：
  1. 「上傳預覽」完整 layout（dropzone-loaded / RouteMapPreview / ElevationProfile / RouteRegions / RouteMetadataForm 去除 tags 欄）。
  2. 「regions 三態」獨立 frame：loading skeleton / ready chips / ready empty / error 提示。

## 11. 開放問題

無。已釐清：
- tags 拆除範圍 = UI + schema + index + 所有測試（全離）。
- 坡度圖位置 = 重用 `<ElevationProfile>`，於地圖預覽下方加 section。
- 縣市鄉鎮時機 = 送出前 Server Action 試算。
- edit 頁 = 同步拆 tags + 加海拔曲線。

## Designs

- [Figma Designs](./designs/figma.md) — frames and acceptance criteria for refactor-upload-metadata-fields. AC-3 adds a chrome refactor: extract `<RouteRegionsSection>` so 「途經區域」 heading is shared between `/admin/upload`, `/admin/routes/[id]`, and the public `/routes/[slug]` pages (no UI drift).
