## Why

`feat-admin-gpx-upload`（封存於 2026-06-21）讓 Yuki 能以「上傳 GPX → 自動算 distance / elevation_gain / bbox → 補 metadata → 發布」上架路線。實作完成後浮現三個摩擦：

1. **手填欄位仍多餘**：`difficulty` 必填、`duration_s` 選填，但兩者語義都可從 GPX 推得（爬升量代表困難度、`<time>` 末減首得耗時）。每上傳一條都要手動填一次是 toil。
2. **公開頁缺一張海拔曲線**：`/routes/[slug]` 目前是 placeholder，`openspec/project.md` long-term goal 1 明確列「路線即作品 — 地圖、海拔曲線、tags」。GPX 已含 `<ele>`，沒做出來。
3. **地區欄位是手填 free text**：`routes.region` 是 `text`，列表頁 `REGION_FILTERS` 寫死了 6 個值（"台北" / "新北" / "宜蘭" / "陽明山" / "其他" / "全部"），與 DB 沒對接。Yuki 跨多區跑時得自己回想經過哪些區。

## What Changes

- **admin-routes-crud**: 移除手填難度 / 預計時長 / 地區欄位（destructive schema migration），表單只剩標題 / slug / 描述 / tags / published；createRoute 改為 explicit `db.transaction` 包 INSERT routes + spatial query + INSERT route_admin_units；列表 / 編輯頁 region 欄改顯示 RouteRegions 文字段落；E2E spec 移除難度 / 時長步驟並加入 RouteRegions chip 與 elevation chart 斷言。
- **route-elevation-profile**：新增 `routes.elevation_profile jsonb` column；擴充 `parseGpx` 計算 distance-elevation series（Douglas-Peucker 2D 簡化至 ≤ 300 點）；新增 server component `<ElevationProfile>` 渲染 SVG 或 `data-testid="elevation-empty"` 空狀態；公開 detail 頁從 placeholder 升級。
- **route-administrative-regions**：新增 `admin_units` 表（PostGIS MultiPolygon + GIST index）與 `route_admin_units` 關聯表；seed migration 匯入內政部縣市 / 鄉鎮區 polygon；新增 `detectRegions` spatial query helper（`ST_Intersects`）與 `<RouteRegions>` 文字段落 component（縣市以 Inter Medium + 森綠強調、鄉鎮以 Inter Regular + 墨黑、連字號 ` — ` 區隔；admin list 走單行 truncate）；公開列表頁 `REGION_FILTERS` 改 SSR 從 DB 動態取縣市。

## Impact

- **Affected specs**:
  - `specs/admin-routes-crud/` — MODIFIED 6 Requirements
  - `specs/route-elevation-profile/` — ADDED (new capability)
  - `specs/route-administrative-regions/` — ADDED (new capability)
- **Affected code**:
  - DB migrations 0004–0008 + Drizzle schema
  - `lib/gpx/parse.ts` / `lib/gpx/simplify.ts` / `lib/gpx/types.ts`
  - `lib/admin-routes/validation.ts` / `lib/admin-routes/detectRegions.ts` (new)
  - `features/admin-routes/*`（form、actions、list、edit、upload state）
  - `features/route-detail/*`（new — ElevationProfile + 整合）
  - `components/RouteRegions.tsx` (new)
  - `app/(public)/routes/page.tsx` / `app/(public)/routes/[slug]/page.tsx` / `app/(admin)/admin/routes/page.tsx`
  - `e2e/admin-routes-upload.spec.ts` / `e2e/admin-routes-edit.spec.ts` / `e2e/public-routes-list.spec.ts`
  - `e2e/fixtures/taipei-loop.gpx` + `e2e/fixtures/offshore.gpx`（new）
  - `scripts/build-admin-units-geojson.ts`（new）
  - `lib/db/migrations/seed/taiwan-admin-units.geojson`（new）
- **Breaking changes**:
  - Yes (DB destructive)。Migration 0004 DROP `routes.difficulty` + `routes.duration_s` + DROP TYPE `difficulty`；migration 0008 DROP `routes.region`。歷史資料中這三欄的值不可復原；`feat-admin-gpx-upload` 完成的上傳資料仍保留（routes row 整體保留，僅這三欄消失），對外 API 與 admin UI 同步更新。
  - 視覺：`RegionChips` 視覺從 chip 改為文字段落（不影響 component identifier，仍以 `<RouteRegions>` 渲染）。

## Related Artifacts

### Design

- [design.md](./design.md)
- [tasks.md](./tasks.md)

### Diagrams

無（brainstorming step 9 決定不採用 PlantUML — 資料流以 design.md §4 ASCII flow 描述）。

### Figma Designs

- [Figma Designs](./designs/figma.md) — 5 wireframe frames：detail 頁 happy / empty、RouteRegions 三 surface 對照、RegionFilter 動態 / empty、admin upload loading skeleton。File key `Yx9G0efBQq3amHPEyeVSDc`、page node `70:2`。
