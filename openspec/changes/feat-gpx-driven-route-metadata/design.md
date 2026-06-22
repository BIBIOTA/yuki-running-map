---
change_id: feat-gpx-driven-route-metadata
doc_language: zh-TW
---

# Design — feat-gpx-driven-route-metadata

## 1. Context & Goal

### 1.1 產品脈絡

`feat-admin-gpx-upload`（封存於 2026-06-21）讓 Yuki 能以「上傳 GPX → 自動算 `distance_m` / `elevation_gain_m` / `bbox` → 補 metadata → 發布」的方式上架路線。實作完成後浮現三個摩擦：

1. **手填欄位仍多餘**：`difficulty` 是必填、`duration_s` 是選填，但 GPX 本身就帶得出兩者的近似值（爬升量代表困難度、`<time>` 末減首得耗時）。每上傳一條都要手動填一次是 toil。
2. **公開頁缺一張海拔曲線**：`/routes/[slug]` 目前是 placeholder。`openspec/project.md` long-term goal 1 明確列出「路線即作品 — 地圖、海拔曲線、tags」。GPX 已有 `<ele>`，只是沒做出來。
3. **地區欄位是手填 free text**：`routes.region` 是 `text`，列表頁的 `REGION_FILTERS` 寫死了 6 個值（"台北" / "新北" / "宜蘭" / "陽明山" / "其他" / "全部"），與 DB 沒對接。Yuki 跨多區跑路時得自己回想途經了哪些區。

### 1.2 Goal

讓 Yuki 上傳 GPX 後**零手填地理資訊**：距離、爬升、海拔曲線、所經縣市 / 鄉鎮區全由 server-side 解析；admin 表單只填路線本身的識別資訊（標題、slug、描述、tags、cover image、published）。

### 1.3 Non-Goal（守住 `openspec/project.md` 邊界）

- 不引入「自動計算難度」演算法 — 移除即移除。
- 不引入 pace / 時間預估演算法 — 移除即移除。
- 不引入 OGC API / 動態行政區同步副系統；內政部年改邊界由手動重跑 migration 處理。
- 不引入 chart 套件（hand-rolled SVG）。
- 不引入 React testing library（沿用既有「邏輯抽 view file、不單測 DOM」策略）。
- 不做 i18n、不做使用者帳號、不做評論互動。

### 1.4 Success criteria

- 上傳表單上看不到難度、預計時長兩個欄位；DB 也沒有對應 column。
- 上傳完，admin 在 edit page 看到「途經區域」chip 顯示由 GPX 自動偵測出的縣市 / 鄉鎮區（read-only）。
- 公開 detail 頁 `/routes/[slug]` 顯示一張海拔曲線（純 SVG，server-rendered）。
- 列表頁 `REGION_FILTERS` 改為 SSR 從 DB 取「至少有一條 published route」的縣市清單。
- 全部 admin / public Playwright 既有 spec 與本案新增 spec 都通過；`openspec validate --strict` 通過。

---

## 2. Scope — A / B / C 三段切分

採方案 ①：單一 `change_id` + 單份 `design.md` + 單份 `tasks.md`；實作切 3 個獨立 mergeable PR。三段順序由依賴決定。

### 2.1 A. 移除手填欄位（destructive schema migration）

**DB**
- `routes` DROP COLUMN `difficulty`、DROP COLUMN `duration_s`、DROP TYPE `difficulty`。
- Migration `0004_drop_route_difficulty_and_duration.sql`。

**Code**
- `lib/admin-routes/validation.ts` 移除 `difficulty` / `durationS` 分支與 `DIFFICULTIES` 常數。
- `features/admin-routes/types.ts` `RouteMetadataValues` 去 `difficulty` / `durationS`。
- `features/admin-routes/RouteMetadataForm.tsx` 移除「難度」、「預計時長」UI。
- `routeMetadataFormState.ts` / `editPageState.ts` / `uploadPageState.ts` 同步去欄位。
- `actions/createRoute.ts` / `actions/updateRoute.ts` 去欄位寫入。

**Tests**
- 更新 `routeMetadataFormState.test.ts`、`validation.test.ts`、admin upload / edit Playwright spec。

**為什麼先做 A**：B / C 都會碰 `RouteMetadataForm` 與 `createRoute.ts`；先把欄位拿掉避免 B/C 在不同 PR 各自 rebase 衝突。

### 2.2 B. 海拔曲線（GPX parse 擴充 + jsonb column + 公開 SVG chart）

**DB**
- `routes` ADD COLUMN `elevation_profile jsonb NOT NULL DEFAULT '[]'::jsonb`。
- Migration `0005_add_elevation_profile.sql`。
- 既有 published rows 留空陣列；前端遇空顯示「此路線無海拔資料」（不做 backfill — out-of-scope §10.1）。

**`lib/gpx/parse.ts` 擴充**
- `GpxMetadata` 新增 `elevationProfile: Array<[number, number]>`（`[distance_m, elevation_m]` pair）。
- 新增 `computeElevationProfile(points: TrackPoint[]): Array<[number, number]>`：
  1. 對 TrackPoint 迭代同時累加 Haversine 距離。
  2. 對每點寫出 `(cumDistM, ele)`；`ele` 為 `undefined` 時跳過該點，distance 仍累積。
  3. 第一點強制為 `[0, ele₀]`。
  4. Douglas-Peucker 2D 簡化（容差 0.5m）。簡化後若 > 300 點，提高容差再跑一次。
  5. `[round(distance), round(ele * 10) / 10]`。
  6. 若有效點數 < 2，回傳 `[]`。
- `simplify.ts` 抽通用 `ramerDouglasPeucker<T>(points, distanceFn, tol)` 給既有 lng/lat 與新 distance/ele 共用。

**Frontend**
- `features/route-detail/elevationProfileView.ts`（純邏輯：profile → SVG `d` 字串、viewBox、座標標籤）。
- `features/route-detail/ElevationProfile.tsx`（server component，輸入 profile，render `<svg>`）。
- `app/(public)/routes/[slug]/page.tsx` 從 placeholder 升級為真資料；嵌入 `<ElevationProfile>` + `<RouteRegions>`（C 段提供）。

**Tests**
- `lib/gpx/__tests__/parse.test.ts` 補「無高度」「正常高度」fixture。
- `features/route-detail/__tests__/elevationProfileView.test.ts` 純邏輯。
- Playwright spec：上傳後 detail 頁 `<svg data-testid="elevation-profile">` 存在或顯示「無海拔資料」。

### 2.3 C. 行政區自動偵測（admin_units 表 + spatial query + UI）

**DB**
- 新 `admin_units` 表（PostGIS MultiPolygon + GIST index）。
- 新 `route_admin_units` join 表（PK `(route_id, admin_unit_id)`，CASCADE on route, RESTRICT on admin_unit）。
- `routes` DROP COLUMN `region`。
- Migrations：`0006_add_admin_units.sql` / `0007_seed_taiwan_admin_units.sql` / `0008_drop_routes_region_add_backfill.sql`。

**資料**
- `lib/db/migrations/seed/taiwan-admin-units.geojson`（pre-processed，~5-10MB，進 repo）。
- `scripts/build-admin-units-geojson.ts`（dev-side 轉檔工具：SHP → 正規化 GeoJSON，含 `ST_MakeValid` 修破碎 polygon。留 repo 給未來年改重用）。

**`createRoute` / `updateRoute`**
- `createRoute` 改為 explicit transaction：parseGpx → INSERT routes returning id → spatial query → INSERT route_admin_units。任一步失敗整段 rollback；Storage upload rollback 沿用既有 best-effort `storage.remove`。
- `updateRoute` 不 re-detect（GPX 不可換；要 re-detect 走「刪除重建」）。

**Frontend**
- `RouteMetadataForm.tsx` 移除手填 region Input；改 read-only `<RouteRegions regions={...}>`。
- `components/RouteRegions.tsx`（generic 文字列元件，admin + public 共用；以「縣市 — 鄉鎮、鄉鎮」格式逐縣市一行 stack；非 chip badge）。
- `lib/regions/types.ts` 純型別 `Region = { code; level; name }`。
- `app/(public)/routes/page.tsx` `REGION_FILTERS` SSR 從 `admin_units` 取縣市清單（過濾「至少一條 published route 對應」）。
- `app/(public)/routes/[slug]/page.tsx` 顯示 `<RouteRegions>`。
- `app/(admin)/admin/routes/page.tsx` 列表頁 `region` 欄改顯示 chips（前 N 個 + 「+M」）。

**Tests**
- `lib/admin-routes/__tests__/detectRegions.integration.test.ts`（mini admin_unit fixture + 跨區/海上/擦邊 GPX）。
- `createRoute.integration.test.ts` 新增 join 表斷言與 transaction rollback 案例。
- Playwright：上傳後 admin form 顯示 detected chip；public list 顯示動態 county filter。

### 2.4 順序與依賴

```
A (~1d) ──► B (~1.5d) ──► C (~2-3d)
schema       parse+jsonb+    spatial query +
diff small   SVG component   seed data + UI swap
```

C 最重：含 SHP→GeoJSON 預處理、PostGIS spatial query 邊界 case、列表頁 filter 改寫。

---

## 3. Schema 變更

### 3.1 Migration 順序

| # | 檔名 | 動作 | Reversible？ |
|---|---|---|---|
| 0004 | `drop_route_difficulty_and_duration.sql` | `DROP COLUMN difficulty, DROP COLUMN duration_s; DROP TYPE difficulty;` | ✗（destructive；欄位無業務語義可重建） |
| 0005 | `add_elevation_profile.sql` | `ADD COLUMN elevation_profile jsonb NOT NULL DEFAULT '[]'::jsonb` | ✓ |
| 0006 | `add_admin_units.sql` | 建 `admin_units` + `route_admin_units` 兩表 + index | ✓ |
| 0007 | `seed_taiwan_admin_units.sql` | 插入 ~370 個鄉鎮 polygon 與 22 個縣市 | ✓（TRUNCATE） |
| 0008 | `drop_routes_region_add_backfill.sql` | 對既有 routes 跑 spatial query backfill 進 `route_admin_units`；DROP COLUMN `region` | ✗ |

**為什麼分 0006 / 0007 / 0008 三步**：結構 / 資料 / routes 連動分離。可單測各段、可單獨 rollback 0007、0008 失敗時可回 0007 結束狀態。

### 3.2 `routes` 表 final shape

```diff
 id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
 slug            text UNIQUE NOT NULL
 title           text NOT NULL
 description     text
 distance_m      int  NOT NULL
 elevation_gain_m int NOT NULL
-duration_s      int
 recorded_at     timestamptz NOT NULL
 location_name   text
-region          text
 tags            text[] NOT NULL DEFAULT '{}'
-difficulty      enum('easy','medium','hard') NOT NULL
 gpx_path        text NOT NULL
 geojson         jsonb NOT NULL
+elevation_profile jsonb NOT NULL DEFAULT '[]'::jsonb
 bbox            geometry(Polygon,4326) NOT NULL
 start_point     geometry(Point,4326)   NOT NULL
 cover_image     text
 published       boolean NOT NULL DEFAULT false
 created_at      timestamptz NOT NULL DEFAULT now()
 updated_at      timestamptz NOT NULL DEFAULT now()
```

### 3.3 `admin_units` 表

```sql
CREATE TYPE admin_level AS ENUM ('county', 'township');

CREATE TABLE admin_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,                       -- 內政部代碼
  level       admin_level NOT NULL,
  name        text NOT NULL,                              -- '台北市' / '中正區'
  parent_code text REFERENCES admin_units(code)
                   DEFERRABLE INITIALLY DEFERRED,
  geom        geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX admin_units_geom_gist  ON admin_units USING GIST (geom);
CREATE INDEX admin_units_level_idx  ON admin_units (level);
```

- `code` 為 stable identifier；name 不 unique（"中山區" 在台北 / 基隆都有）。
- `parent_code` self-FK + `DEFERRABLE INITIALLY DEFERRED` 讓 seed 在單一 transaction 任意順序插入。
- `MultiPolygon`（非 Polygon）：縣市 / 鄉鎮可能含外島或多塊地。

### 3.4 `route_admin_units` 表

```sql
CREATE TABLE route_admin_units (
  route_id      uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  admin_unit_id uuid NOT NULL REFERENCES admin_units(id) ON DELETE RESTRICT,
  PRIMARY KEY (route_id, admin_unit_id)
);

CREATE INDEX route_admin_units_admin_unit_idx ON route_admin_units (admin_unit_id);
```

- `CASCADE` on route：路線刪掉，join 自動清。
- `RESTRICT` on admin_unit：年改 migration 不會誤刪仍被引用的區。
- 反查 index 給「某區下有哪些路線」（公開列表頁未來 cascading）。

### 3.5 `elevation_profile` jsonb 形狀

```json
[
  [0,     12],
  [105,   14],
  [218,   18],
  ...
  [15028, 12]
]
```

`[distance_m, elevation_m]` pair 陣列，distance 累計、單調遞增。≤ 300 點。空陣列代表 GPX 無 `<ele>` 資料。

### 3.6 RLS

- `admin_units`：`anon SELECT` 全開（公開靜態資料）。Admin 寫入由 migration 完成；不需 admin write policy。
- `route_admin_units`：
  - `anon SELECT` 限「對應到 `published=true` 的 route」（與 `routes` 對稱）。
  - Admin full access via `app_admin_github_username()`（沿用既有 admin identity 函式）。

### 3.7 Drizzle schema (`lib/db/schema.ts`) diff

- `routes`：去 `difficulty` / `durationS` / `region`；加 `elevationProfile`；不再 export `difficultyEnum`。
- 新增 `adminLevelEnum`、`adminUnits` table、`routeAdminUnits` table。
- `lib/db/postgis.ts` 新增 `geometryMultiPolygon4326(name)` helper（與既有 `geometryPolygon4326` 同形）。

---

## 4. 資料流

### 4.1 A 段（移除欄位後的 createRoute 簡化）

```
Browser GpxDropzone ──▶ parseGpx (client preview)
                         │
                         ▼
                       FormData {title, slug, description,
                                 tags, published, gpxFile}
                         │
                         ▼
                Server Action: createRoute
                 1. parseMetadataFromFormData   ← 刪去 difficulty/durationS 分支
                 2. validateRouteMetadata       ← 對應 schema 簡化
                 3. parseGpx(buffer)
                 4. Storage upload
                 5. INSERT routes row           ← 少 2 個 column
                 6. revalidatePath × 3
                 7. return {ok, id, slug}
```

### 4.2 B 段（elevation_profile）

`parseGpx` 內部多算一個 series：

```
extractTrackPoints (existing) ──▶ TrackPoint[] with .ele
                                    │
                                    ├─▶ computeDistanceM           (existing)
                                    ├─▶ computeElevationGainM      (existing)
                                    ├─▶ computeBbox                (existing)
                                    └─▶ computeElevationProfile    (NEW)
```

`GpxMetadata.elevationProfile` 變成 server-action INSERT 的一部分：

```
parseGpx(buffer) → {..., elevationProfile} → INSERT routes (elevation_profile = $1)
```

Detail 頁讀取：

```
RouteDetailPage (server component)
   ▼
db.select().from(routes).where(eq(slug, ...))
   ▼
route.elevationProfile  →  <ElevationProfile profile={...} />
                              │
                              ▼
                         pure → <svg viewBox=... d=... />
                         no client JS、no hydration
```

空陣列時 `<ElevationProfile>` render「此路線無海拔資料」，不畫圖。

### 4.3 C 段（admin_units 偵測 + UI swap）

**Upload 時**（C 段必需把 createRoute 包成 explicit transaction）：

```
createRoute
   ▼
parseGpx → geojson LineString
   ▼
db.transaction:
   1. INSERT routes returning id
   2. SELECT id FROM admin_units
       WHERE ST_Intersects(geom, ST_GeomFromGeoJSON($1))      ← 傳簡化 LineString
   3. INSERT INTO route_admin_units (route_id, admin_unit_id)
       SELECT $newRouteId, id FROM (step 2)
   ▼
revalidatePath × 3
```

任一步失敗整段 rollback；Storage upload rollback 沿用既有 best-effort `storage.remove`。

**Edit 時**：不 re-detect（GPX 不可換；要 re-detect 走「刪除重建」）。

**Public detail 顯示**：

```
RouteDetailPage SSR
   ▼
db.select({route, regions: ...})
  .from(routes)
  .leftJoin(routeAdminUnits, ...)
  .leftJoin(adminUnits, ...)
  .where(eq(slug, ...))
   ▼
groupBy id → {route, regions: [{code, level, name}, ...]}
   ▼
<RouteRegions regions={...} />
```

**Public list filter**：

```
RoutesListPage SSR
   ▼
db.select({code, name})
  .from(adminUnits)
  .where(and(
    eq(level, 'county'),
    exists(routes JOIN route_admin_units WHERE published)
  ))
   ▼
<RegionFilters counties={...} />
```

本案先做縣市；鄉鎮 cascading 留後續 PR（§10.2 候選 P2）。

**Admin edit form**：

```
EditPageClient (server-loaded)
   ▼
{route, detectedRegions: [{level, name}, ...]}
   ▼
<RouteMetadataForm routeRegions={detectedRegions} />
   - 不顯示 region <Input>
   - <RouteRegions read-only />
```

### 4.4 Transaction 邊界小結

| 段 | 寫入動作 | Transaction |
|---|---|---|
| A | INSERT routes（少 2 column） | 沿用既有 |
| B | INSERT routes（多 elevation_profile） | 同一 INSERT |
| C | INSERT routes + INSERT route_admin_units | **包成同 transaction**；任一失敗整 rollback |

---

## 5. 元件邊界與檔案影響

### 5.1 完整檔案 inventory

| Path | 動作 | 段 | 備註 |
|---|---|---|---|
| `lib/db/migrations/0004_drop_route_difficulty_and_duration.sql` | NEW | A | DROP × 2 + DROP TYPE |
| `lib/db/migrations/0005_add_elevation_profile.sql` | NEW | B | ADD jsonb DEFAULT '[]' |
| `lib/db/migrations/0006_add_admin_units.sql` | NEW | C | 建表 + index |
| `lib/db/migrations/0007_seed_taiwan_admin_units.sql` | NEW | C | seed via `\copy` |
| `lib/db/migrations/0008_drop_routes_region_add_backfill.sql` | NEW | C | backfill + DROP region |
| `lib/db/migrations/seed/taiwan-admin-units.geojson` | NEW | C | ~5-10MB |
| `lib/db/schema.ts` | MODIFY | A+B+C | 刪/加 columns、加 admin_units / route_admin_units |
| `lib/db/postgis.ts` | MODIFY | C | 加 `geometryMultiPolygon4326` |
| `scripts/build-admin-units-geojson.ts` | NEW | C | SHP → GeoJSON 轉檔工具 |
| `lib/gpx/parse.ts` | MODIFY | B | 加 `computeElevationProfile` |
| `lib/gpx/simplify.ts` | MODIFY | B | 抽通用 `ramerDouglasPeucker<T>` |
| `lib/gpx/types.ts` | MODIFY | B | `GpxMetadata.elevationProfile` |
| `lib/gpx/__fixtures__/*` | MODIFY | B | 補無高度 / 含高度 fixture |
| `lib/gpx/__tests__/parse.test.ts` | MODIFY | B | 新斷言 |
| `lib/gpx/__tests__/simplify.test.ts` | MODIFY/NEW | B | 泛型測試 |
| `lib/admin-routes/validation.ts` | MODIFY | A | 移除分支 |
| `lib/admin-routes/__tests__/validation.test.ts` | MODIFY | A | 移除斷言 |
| `lib/admin-routes/detectRegions.ts` | NEW | C | spatial query helper |
| `lib/admin-routes/__tests__/detectRegions.integration.test.ts` | NEW | C | mini admin_unit fixture |
| `lib/admin-routes/__tests__/detectRegionsView.test.ts` | NEW | C | 純邏輯部分 |
| `lib/regions/types.ts` | NEW | C | `Region` type |
| `components/RouteRegions.tsx` | NEW | C | generic 文字列元件（縣市 — 鄉鎮、鄉鎮 逐行 stack） |
| `features/admin-routes/types.ts` | MODIFY | A+C | 去欄位、加 detectedRegions |
| `features/admin-routes/RouteMetadataForm.tsx` | MODIFY | A+C | 刪 2 row + 刪 region Input + 加 chip |
| `features/admin-routes/routeMetadataFormState.ts` | MODIFY | A | 對齊 shape |
| `features/admin-routes/uploadPageState.ts` | MODIFY | A | FormData 對齊 |
| `features/admin-routes/editPageState.ts` | MODIFY | A+C | 對齊 |
| `features/admin-routes/UploadPageClient.tsx` | MODIFY | C | 帶 detectedRegions |
| `features/admin-routes/EditPageClient.tsx` | MODIFY | C | server-loaded regions 傳入 |
| `features/admin-routes/actions/createRoute.ts` | MODIFY | A+B+C | (A) 移欄位 (B) 寫 elevation_profile (C) transaction + detectRegions |
| `features/admin-routes/actions/updateRoute.ts` | MODIFY | A | 移欄位 |
| `features/admin-routes/actions/__tests__/createRoute.integration.test.ts` | MODIFY | A+B+C | 更新斷言 |
| `features/admin-routes/actions/__tests__/updateRoute.integration.test.ts` | MODIFY | A | 更新斷言 |
| `features/admin-routes/RouteList.tsx` | MODIFY | C | region 欄改 chips |
| `features/admin-routes/routeListView.ts` | MODIFY | C | view-model 對齊 |
| `features/route-detail/elevationProfileView.ts` | NEW | B | 純邏輯 |
| `features/route-detail/ElevationProfile.tsx` | NEW | B | server component |
| `features/route-detail/__tests__/elevationProfileView.test.ts` | NEW | B | 純邏輯 |
| `app/(public)/routes/[slug]/page.tsx` | MODIFY | B+C | placeholder → 真資料 |
| `app/(public)/routes/page.tsx` | MODIFY | C | REGION_FILTERS 動態 |
| `app/(admin)/admin/routes/page.tsx` | MODIFY | C | 列表加 join |
| `e2e/admin-routes-upload.spec.ts` | MODIFY | A+C | 移欄位斷言、加 chip 斷言、加 elevation 斷言 |
| `e2e/admin-routes-edit.spec.ts` | MODIFY | A+C | 同上 |
| `e2e/admin-routes-delete.spec.ts` | NO CHANGE | — | CASCADE 由 schema 保證 |
| `e2e/public-routes-list.spec.ts` | NEW or MODIFY | C | 動態 county filter |
| `e2e/helpers/seed.ts` | MODIFY | A+C | 更新 seedRoute、加 seedAdminUnits |
| `e2e/fixtures/taipei-loop.gpx` | NEW | C | 跨中正 / 大安兩區 |
| `e2e/fixtures/offshore.gpx` | NEW | C | 全在海上 |
| `docs/data-model.md` | MODIFY | A+B+C | 反映最終 schema |
| `docs/runbooks/admin-units-refresh.md` | NEW | C | 年改流程文件 |

### 5.2 元件規模量級

```
A 段：~10 個檔案（小、單純）
B 段：~8 個檔案 + 1 SVG component（中）
C 段：~18 個檔案 + 1 個 ~5-10MB GeoJSON（大）
```

C 段 PR 可內部再切「C1 schema + seed migration」「C2 detectRegions + Server Action」「C3 UI swap」三 commit 但同 PR。

### 5.3 Folder boundary

- `components/RouteRegions.tsx`：generic 視覺元件，與 shadcn primitive 並排。
- `lib/regions/types.ts`：純型別。
- `features/admin-routes/` / `features/route-detail/` 兩個 feature 都 `import` `components/RouteRegions`，不互 import（符合 AGENTS.md folder-boundaries 約束）。

---

## 6. Edge cases & 錯誤處理

### 6.1 A 段

| 狀況 | 處理 |
|---|---|
| Migration 跑到一半失敗 | `DROP TYPE` 須在 `DROP COLUMN` 之後；單一 transaction 自動 rollback。 |
| 舊 client / 舊 FormData 仍送 `difficulty` / `duration_s` | `validateRouteMetadata` 忽略未知欄位（既有行為）。 |
| `routeListView.ts` 既有 snapshot | 更新 fixture。 |
| E2E spec 內含「填寫難度」步驟 | 移除步驟與斷言。 |

### 6.2 B 段

| 狀況 | 處理 |
|---|---|
| GPX 無 `<ele>` 標籤 | `elevationProfile: []`；`<ElevationProfile profile={[]} />` 顯示「此路線無海拔資料」（zh-TW）。 |
| GPX 只有少數 `<ele>` | profile 稀疏。≥ 2 點即繪。 |
| `<ele>` 含異常值（負海拔 -32768 / 1e9） | 不過濾，視為 GPX 髒；SVG viewBox 會被拉爆，留 admin 注意。`NaN` / `Infinity` 已被 `toFiniteNumber` 擋。 |
| Profile 第一點 distance 不是 0 | 強制 `[0, ele₀]`，後續累加。 |
| Douglas-Peucker 點數 < 2 | 直接 return；不簡化。 |
| 共用 `ramerDouglasPeucker<T>` 與既有 lng/lat 重複 | 抽通用版本（相關 refactor，符合 brainstorming 原則）。 |
| GPX > 50k trackpoints | 無上限；簡化後保證 ≤ 300。 |
| 既有 published rows 的空 `elevation_profile` | 顯示「無海拔資料」；backfill 列為後續 PR（§10.1）。 |

### 6.3 C 段

| 狀況 | 處理 |
|---|---|
| GPX 完全在海上 / 國外（0 交集） | `route_admin_units` 0 rows；UI 不顯示 RouteRegions；不阻擋上傳。 |
| GPX 跨多區（沿河跑穿 5 區） | 全部 INSERT；UI 顯示前 N 個 + 「+M」（N 由 Figma 階段決定，preset 3）。 |
| Admin 改路線 GPX | 不支援；走「刪除重建」流程（沿用既有約定）。 |
| Spatial query 慢 | `admin_units` ~370 polygon + GIST index；單條 LineString 預期 < 50ms。verification 階段量測。 |
| `ST_GeomFromGeoJSON` 接到大 LineString 失敗 | 傳 `geojson.geometry.coordinates`（已簡化）進 spatial query，不傳 raw trackpoints。 |
| `route_admin_units` INSERT race | 單一 admin、無並行寫；PK 仍會擋重複。 |
| Migration 0008 backfill 部分 row 失敗 | `WHERE NOT EXISTS` 過濾；失敗 row 留空，admin 手動補（或刪除重建）。0008 不因單行整 abort。 |
| Seed GeoJSON 有破碎 polygon | `scripts/build-admin-units-geojson.ts` 跑 `ST_MakeValid` 修；migration 信任 seed 資料。 |
| 內政部年改 | runbook `docs/runbooks/admin-units-refresh.md`；不包在本案。 |

### 6.4 錯誤訊息（zh-TW）

| 觸發點 | 訊息 |
|---|---|
| transaction 失敗 | `寫入失敗，請稍後再試` |
| Spatial query 拋例外 | `行政區判斷失敗：{message}`（admin form `_form` alert） |
| GPX 無 `<ele>`（不視為錯誤） | detail 頁顯示「此路線無海拔資料」 |

### 6.5 Observability

- Spatial query 失敗 → `console.error` + transaction rollback。
- profile 解析 > 1s → 不阻擋、無 logging。
- 本案不引入新 telemetry / metrics（owner-only 個人專案）。

---

## 7. Testing 策略

### 7.1 Test pyramid by 段

| Layer | A | B | C |
|---|---|---|---|
| Unit (vitest, node env) | validation, form-state, view-model | `computeElevationProfile`, `ramerDouglasPeucker<T>`, elevationProfileView | detectRegions view 純邏輯部分 |
| Integration (vitest + Supabase) | createRoute / updateRoute | parseGpx fixture | `detectRegions.integration.test.ts` + createRoute transaction rollback |
| E2E (Playwright, chromium) | upload / edit spec（移欄位） | detail 頁 SVG | admin chip + public dynamic county filter |

### 7.2 新增 / 修改檔案

詳見 §5.1 inventory `__tests__` rows。

### 7.3 Fixtures

| Path | 用途 |
|---|---|
| `lib/gpx/__fixtures__/with-elevation.gpx` | 既有 / 補 |
| `lib/gpx/__fixtures__/no-elevation.gpx` | 新；trackpoints 但無 `<ele>` |
| `e2e/fixtures/taipei-loop.gpx` | 跨中正 / 大安兩區短迴圈 |
| `e2e/fixtures/offshore.gpx` | 全在海上 |

### 7.4 CI gates

| Gate | A | B | C |
|---|---|---|---|
| `pnpm typecheck` | ✓ | ✓ | ✓ |
| `pnpm lint` | ✓ | ✓ | ✓ |
| `pnpm test` | ✓ | ✓ | ✓ |
| `pnpm test:e2e` | ✓ | ✓ | ✓ |
| `openspec validate --strict` | per change-id 一次 | — | — |

### 7.5 「不測」清單

- `<ElevationProfile>` 與 `<RouteRegions>` 的 DOM render — 邏輯抽 view file；DOM 不單測（CLAUDE.md 約束）。
- 內政部 SHP 原檔解析 — `scripts/build-admin-units-geojson.ts` 不在 spec 範圍。
- 大檔 GPX 效能 — verification 階段 ad-hoc 量測，spec 不強制。
- Visual regression — 無 snapshot infra；本案不引入。

---

## 8. 視覺 / 設計（Figma 預留）

本案接 `spec-driven-dev:writing-figma`，預計產出三類 frame：

- 公開 detail 頁整體版面（含 `<ElevationProfile>` 區塊 + `<RouteRegions>` 區塊；Trail Vintage 線條 / 配色）。
- `<RouteRegions>` variant set（admin form read-only、public detail、admin list 三處）。
- 公開列表頁 `REGION_FILTERS` 動態狀態（0/N/M 個 county）。

Figma 階段細節由 `writing-figma` skill 主導。

---

## 9. Probable next steps

依 brainstorming step 9：

- **UML（PlantUML）**：不採用。本案資料流以 §4 ASCII 流圖 + 文字描述足以。
- **Figma**：採用。`writing-plans` → `writing-figma` → `writing-spec` → `subagent-driven-development` 或 `test-driven-development`。

---

## Designs

- [Figma Designs](./designs/figma.md) — 5 wireframe frames for feat-gpx-driven-route-metadata（detail happy / detail empty / RouteRegions 三 surface 對照 / RegionFilter 動態 / loading skeleton）。

## 10. Out-of-scope（明確劃線）

| # | 項目 | 後續處理 |
|---|---|---|
| 10.1 | 既有 published routes elevation_profile backfill | 後續 PR：寫 backfill script 重下 GPX → re-parse → UPDATE |
| 10.2 | 鄉鎮級 cascading filter（列表頁 `?county=X` → 第二級 chip） | 後續 PR |
| 10.3 | Edit 時 re-detect regions（含 GPX 重上傳） | 後續 PR；沿用「刪除重建」直至此完成 |
| 10.4 | Admin 手動 ± detected regions | 後續 PR：新 UI + 新 Server Action |
| 10.5 | 行政區年改 migration 0009 | 不寫；以 runbook 取代 |
| 10.6 | Chart 互動（hover tooltip） | 後續 PR；需新 client component |
| 10.7 | Difficulty / duration 替代欄位 | 不引入 |
| 10.8 | `routes.location_name` 欄位審視 | 後續評估；本案不動 |
| 10.9 | i18n / 英文化 | 永不（project.md non-goal） |
