## Why

`/admin/upload` 目前的預覽流程缺三件事：

1. `parseGpx()` 已回傳 `elevationProfile`（≤ 300 [distance, elevation] 對），但 `UploadPageClient` 沒有把它渲染出來，**沒有坡度圖預覽**。
2. `route_admin_units` 是在 `createRoute` Server Action 內透過 PostGIS `ST_Intersects` 算出來，整段 server-only，使用者**在送出前看不到縣市鄉鎮**會落在哪裡。
3. `routes.tags text[]`（+ GIN 索引 + `TagsInput` + `listExistingTags` + validation rule）整條鏈在實際使用流程裡已經沒人用。它仍佔據表單一塊欄位、增加 schema / index / 測試成本，是**多餘欄位**。

此外，「途經區域」chrome 在三個 surface 各自實作了不同樣式（公開 detail 用 mono uppercase muted heading；admin 邊欄用 `text-sm font-medium`；上傳預覽缺失），無法共用、易漂移。

## What Changes

- **admin-routes-crud**:
  - MODIFIED `RouteMetadataForm` — 移除「標籤」`<Field>` + `<TagsInput>` + `existingTags` prop；同步移除 `routeRegions` prop（chrome 由共用 `<RouteRegionsSection>` 接手）。
  - MODIFIED `createRoute` / `updateRoute` Server Actions — 不再 parse / validate / INSERT / UPDATE `tags`。
  - MODIFIED `validateRouteMetadata` — 移除 `tags` 規則。
  - MODIFIED `UploadPageClient` — 預覽區塊新增 `<ElevationProfile>` 與 `<RouteRegionsSection>`，並在 `handleFile` 結尾呼叫新的 `previewRegions` Server Action。
  - MODIFIED `EditPageClient` — 地圖預覽下方掛 `<ElevationProfile>`；regions 改由 `<RouteRegionsSection>` 渲染。
  - MODIFIED `/admin/upload` + `/admin/routes/[id]` server pages — 不再呼叫 `listExistingTags`，不再傳 `existingTags` prop。
  - REMOVED `TagsInput`, `tags.ts`, `listExistingTags`, schema `routes.tags` 欄位 + `routes_tags_gin` 索引（migration 0009）。

- **route-administrative-regions**:
  - ADDED `previewRegions` read-only Server Action（共用 `lib/admin-routes/detectRegions`，admin-only）。
  - ADDED `<RouteRegionsSection>` 共用 chrome 元件（heading + 三 surface 共同的 section wrapper）。
  - MODIFIED 公開 `/routes/[slug]` 與 admin 邊欄全部改用 `<RouteRegionsSection>`；ready-empty / loading / error 三態 UI 加入。

- **route-elevation-profile**:
  - ADDED `<ElevationProfile>` 渲染於 `/admin/upload` 預覽與 `/admin/routes/[id]` edit 頁。

## Impact

- **Affected specs**:
  - `specs/admin-routes-crud/`
  - `specs/route-administrative-regions/`
  - `specs/route-elevation-profile/`
- **Affected code**:
  - `features/admin-routes/**` — UploadPageClient, RouteMetadataForm, EditPageClient, form-state helpers, actions/{createRoute, updateRoute}, TagsInput (deleted), tags.ts (deleted)
  - `components/RouteRegions.tsx` — extract `<RouteRegionsSection>`
  - `lib/admin-routes/{validation, listExistingTags(deleted)}` + `actions/previewRegions.ts`（new）
  - `lib/db/{schema.ts, migrations/0009_drop_routes_tags.sql(new)}`
  - `app/(admin)/admin/{upload, routes/[id]}/page.tsx`
  - `app/(public)/routes/[slug]/page.tsx`
  - `e2e/{admin-upload, admin-route-edit}.spec.ts` + 相關 vitest 單元 / integration tests
- **Breaking changes**:
  - **Yes** at the database layer — `ALTER TABLE routes DROP COLUMN tags` 不可逆，release 前需 dump 備份（runbook 已記）。
  - 沒有對外 API 客戶端的破壞性影響（admin-only 表單欄位）。

## Related Artifacts

### Design
- [design.md](./design.md)
- [tasks.md](./tasks.md)

### Diagrams
無 PlantUML（design.md 第 6 節已用 discriminated union + ASCII 流程圖完整描述 `regionsState` 三態 + previewRegions / createRoute 序列）。

### Figma Designs
- [Figma reference](./designs/figma.md) — 5 frames：upload-preview happy-path + 4 regions 狀態。
