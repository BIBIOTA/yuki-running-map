---
change_id: feat-gpx-driven-route-metadata
doc_language: zh-TW
---

# Tasks: feat-gpx-driven-route-metadata

任務依 design.md §2 的三段切分排列。三段順序為 A → B → C；每段 group 內部任務以序號標示依賴。`status` 預設 `not_started`，由下游 SDD/TDD/verification skill 更新。

## 1. Group A — 移除手填欄位（PR-A）

- [ ] 1.1 寫 migration `0004_drop_route_difficulty_and_duration.sql`
  - Acceptance: WHEN `pnpm db:migrate` 在 fresh DB 跑完 THEN `routes` 表已無 `difficulty` 與 `duration_s` columns AND `difficulty` enum type 已 DROP AND `pnpm db:generate --strict` 對 schema.ts 不產出新 migration（drift = 0）
  - Depends on: -
  - Independence: independent
  - status: not_started

- [ ] 1.2 更新 `lib/db/schema.ts`：刪 `difficulty` / `durationS` columns 與 `difficultyEnum` export
  - Acceptance: WHEN `pnpm typecheck` 跑 THEN 0 error AND `Route` / `NewRoute` types 不再含 `difficulty` / `durationS`
  - Depends on: 1.1
  - Independence: serial
  - status: not_started

- [ ] 1.3 更新 `lib/admin-routes/validation.ts` 與 `__tests__/validation.test.ts`：移除 difficulty / durationS 分支與 `DIFFICULTIES` 常數
  - Acceptance: WHEN `validateRouteMetadata({...})` 接到不含 `difficulty` / `duration_s` 的物件 THEN 回傳 `{ok:true, value}` AND `RouteMetadataInput` interface 不再含這兩欄 AND validation 測試全綠
  - Depends on: 1.2
  - Independence: serial
  - status: not_started

- [ ] 1.4 更新 `features/admin-routes/types.ts`、`routeMetadataFormState.ts`、`uploadPageState.ts`、`editPageState.ts` 與對應 `__tests__/*State.test.ts`
  - Acceptance: WHEN 任何 form state helper 被 typecheck THEN 編譯通過 AND `RouteMetadataValues` 不再含 `difficulty` / `durationS` AND `uploadPageState.buildCreateRouteFormData(v)` 不再 append difficulty / duration_s 鍵
  - Depends on: 1.3
  - Independence: serial
  - status: not_started

- [ ] 1.5 更新 `features/admin-routes/RouteMetadataForm.tsx`：移除「難度」與「預計時長」兩個 row
  - Acceptance: WHEN visitor 開啟 `/admin/upload` 或 `/admin/routes/[id]` THEN form 上沒有 `id="difficulty"` 也沒有 `id="duration_s"` 元素 AND 其餘欄位佈局保留
  - Depends on: 1.4
  - Independence: serial
  - status: not_started

- [ ] 1.6 更新 `features/admin-routes/actions/createRoute.ts` 與 `actions/updateRoute.ts`：刪欄位寫入與相關 FormData 取值
  - Acceptance: WHEN `createRoute(formData)` 在不含 `difficulty` / `duration_s` 的 FormData 下執行 THEN INSERT routes 成功 AND 不對既存 columns 寫入 difficulty/duration_s AND `updateRoute` 同樣不接受這兩欄
  - Depends on: 1.5
  - Independence: serial
  - status: not_started

- [ ] 1.7 更新 `features/admin-routes/actions/__tests__/createRoute.integration.test.ts` 與 `updateRoute.integration.test.ts`、`features/admin-routes/routeListView.ts` 既有 snapshot 與 `RouteList.tsx` 顯示
  - Acceptance: WHEN `pnpm test` 跑 THEN 所有既有 integration 測試 + view-model 測試綠 AND snapshot 中不含 difficulty
  - Depends on: 1.6
  - Independence: serial
  - status: not_started

- [ ] 1.8 更新 `e2e/admin-routes-upload.spec.ts`、`admin-routes-edit.spec.ts`、`e2e/helpers/seed.ts`：移除填寫難度 / 時長步驟與斷言、`seedRoute` 簽章對齊
  - Acceptance: WHEN `pnpm test:e2e` 跑 THEN admin upload + edit spec 全綠 AND 沒有任何 e2e 步驟操作 `#difficulty` / `#duration_s`
  - Depends on: 1.7
  - Independence: serial
  - status: not_started

- [ ] 1.9 A 段 verification：執行 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
  - Acceptance: WHEN 四個指令依序執行 THEN 全部 exit 0
  - Depends on: 1.8
  - Independence: serial
  - status: not_started

## 2. Group B — 海拔曲線（PR-B）

- [ ] 2.1 寫 migration `0005_add_elevation_profile.sql`
  - Acceptance: WHEN `pnpm db:migrate` 跑 THEN `routes.elevation_profile` 存在、型別 `jsonb NOT NULL DEFAULT '[]'::jsonb` AND 既有 rows 的 `elevation_profile` 為 `'[]'::jsonb`
  - Depends on: 1.9
  - Independence: independent
  - status: not_started

- [ ] 2.2 重構 `lib/gpx/simplify.ts`：抽通用 `ramerDouglasPeucker<T>(points, distanceFn, tol)`，既有 lng/lat 簡化改 thin wrapper；新增 `__tests__/simplify.test.ts`
  - Acceptance: WHEN 既有的 lng/lat 簡化測試跑 THEN 全綠 AND 直線 3 點以 RDP 簡化會減為 2 點 AND 1-2 點輸入 idempotent
  - Depends on: 2.1
  - Independence: serial
  - status: not_started

- [ ] 2.3 擴充 `lib/gpx/types.ts`（`GpxMetadata.elevationProfile`）與 `lib/gpx/parse.ts`（新 `computeElevationProfile`）；補 fixtures `with-elevation.gpx` / `no-elevation.gpx`；擴充 `__tests__/parse.test.ts`
  - Acceptance: WHEN parseGpx 接到含 `<ele>` 的 GPX THEN `elevationProfile` 為 `[distance_m, elevation_m]` pair 陣列 AND `length ∈ [2, 300]` AND `elevationProfile[0][0] === 0` AND distance 單調遞增 AND WHEN GPX 無 `<ele>` THEN `elevationProfile === []`
  - Depends on: 2.2
  - Independence: serial
  - status: not_started

- [ ] 2.4 更新 `lib/db/schema.ts`：加 `elevationProfile` jsonb column
  - Acceptance: WHEN typecheck 跑 THEN `Route` type 含 `elevationProfile`（jsonb 型別） AND `NewRoute` 可選或必填一致於 design §3.5
  - Depends on: 2.3
  - Independence: serial
  - status: not_started

- [ ] 2.5 把 `elevationProfile` 寫入 `createRoute` 的 INSERT；更新 `createRoute.integration.test.ts` 斷言
  - Acceptance: WHEN createRoute 以含 ele 的 fixture 成功 THEN DB row `elevation_profile` 為 parseGpx 計算結果 AND WHEN 以無 ele fixture 成功 THEN DB row `elevation_profile = '[]'`
  - Depends on: 2.4
  - Independence: serial
  - status: not_started

- [ ] 2.6 新增 `features/route-detail/elevationProfileView.ts` 純邏輯 + `__tests__/elevationProfileView.test.ts`
  - Acceptance: WHEN `profileToSvg(profile)` 接非空 array THEN 回傳含 `d="M0,Y L X,Y..."`、`viewBox`、`yLabels`、`xLabels` 的物件 AND WHEN 接 `[]` THEN `{ kind:'empty' }` 標記
  - Depends on: 2.3
  - Independence: parallel-safe（與 2.4/2.5 可同步）
  - status: not_started

- [ ] 2.7 新增 `features/route-detail/ElevationProfile.tsx`（server component）
  - Acceptance: WHEN 以非空 profile render THEN 輸出含 `<svg data-testid="elevation-profile" viewBox="...">`、`<path d="...">`、軸標籤 AND WHEN 以 `[]` render THEN 輸出 `<p data-testid="elevation-empty">此路線無海拔資料</p>`
  - Depends on: 2.6
  - Independence: serial
  - status: not_started

- [ ] 2.8 升級 `app/(public)/routes/[slug]/page.tsx` 從 placeholder 到真資料；嵌入 `<ElevationProfile profile={route.elevationProfile} />`
  - Acceptance: WHEN visitor 開啟 `/routes/{published-slug}` THEN page SSR 含 elevation SVG 或 empty hint AND title 與描述用 `route.title` / `route.description`
  - Depends on: 2.5, 2.7
  - Independence: serial
  - status: not_started

- [ ] 2.9 更新 `e2e/admin-routes-upload.spec.ts`：上傳並 publish 後造訪 `/routes/[slug]` 斷言 elevation 元件
  - Acceptance: WHEN upload-publish flow 跑 THEN public detail 頁存在 `data-testid="elevation-profile"` 或 `data-testid="elevation-empty"`
  - Depends on: 2.8
  - Independence: serial
  - status: not_started

- [ ] 2.10 B 段 verification：`pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
  - Acceptance: WHEN 四個指令依序執行 THEN 全部 exit 0
  - Depends on: 2.9
  - Independence: serial
  - status: not_started

## 3. Group C — 行政區自動偵測（PR-C）

- [ ] 3.1 寫 `scripts/build-admin-units-geojson.ts`（dev-side 工具：SHP → 正規化 GeoJSON，含 `ST_MakeValid` 修破碎 polygon）
  - Acceptance: WHEN `pnpm tsx scripts/build-admin-units-geojson.ts <shp-path>` 跑 THEN 輸出 `lib/db/migrations/seed/taiwan-admin-units.geojson`（FeatureCollection） AND 每個 feature 含 `properties.code` / `level('county'|'township')` / `name` / `parent_code` AND geometry 為 MultiPolygon valid
  - Depends on: 2.10
  - Independence: independent
  - status: not_started

- [ ] 3.2 跑一次 script 產出 seed GeoJSON 並 commit 進 repo
  - Acceptance: WHEN seed 檔被讀 THEN 含 22 個 county + ~370 個 township feature AND 檔案大小 < 15MB
  - Depends on: 3.1
  - Independence: serial
  - status: not_started

- [ ] 3.3 寫 migration `0006_add_admin_units.sql`：建 `admin_units` + `route_admin_units` 表 + index
  - Acceptance: WHEN `pnpm db:migrate` 跑 THEN `admin_units` 存在（PK uuid、`code` UNIQUE、`level` enum、`parent_code` self-FK DEFERRABLE、`geom MultiPolygon SRID 4326`、GIST(geom)、level idx） AND `route_admin_units` 存在（PK `(route_id, admin_unit_id)`、CASCADE on route、RESTRICT on admin_unit、admin_unit_id index）
  - Depends on: 3.2
  - Independence: serial
  - status: not_started

- [ ] 3.4 加 `lib/db/postgis.ts` 的 `geometryMultiPolygon4326(name)` helper；更新 `lib/db/schema.ts` 加 `adminLevelEnum` / `adminUnits` / `routeAdminUnits` table objects
  - Acceptance: WHEN typecheck 跑 THEN 0 error AND `AdminUnit` / `NewAdminUnit` / `RouteAdminUnit` types export
  - Depends on: 3.3
  - Independence: serial
  - status: not_started

- [ ] 3.5 寫 migration `0007_seed_taiwan_admin_units.sql`：從 seed GeoJSON 載入 admin_units rows
  - Acceptance: WHEN migrate 在 0006 之上跑 THEN `admin_units` 約 392 rows (22 county + ~370 township) AND 每個 township 的 `parent_code` 指向 valid county code AND county 的 `parent_code` 為 NULL
  - Depends on: 3.4
  - Independence: serial
  - status: not_started

- [ ] 3.6 新增 `lib/regions/types.ts`（`Region = {code, level, name}`）與 `lib/admin-routes/detectRegions.ts`（spatial query helper）；補 `__tests__/detectRegions.integration.test.ts`（mini admin_unit fixture + 三條 GPX：跨區、海上、擦邊）
  - Acceptance: WHEN `detectRegions(tx, geojson)` 收到跨兩個 polygon 的 LineString THEN 回 2 個 admin_unit_id AND 收到不在任何 polygon 內的 LineString THEN 回 0 個 AND 擦邊（ST_Intersects=true）THEN 回 1 個
  - Depends on: 3.5
  - Independence: serial
  - status: not_started

- [ ] 3.7 寫 migration `0008_drop_routes_region_add_backfill.sql`：對既有 routes 跑 spatial query backfill 進 `route_admin_units`；最後 `ALTER TABLE routes DROP COLUMN region`
  - Acceptance: WHEN migrate 跑 THEN 既有每條 route 經 `ST_Intersects` 算出的 admin_units 都已 INSERT 至 `route_admin_units` AND `routes` 表已無 `region` column AND migration 對 0 routes 或單行失敗 row 不整 abort（`WHERE NOT EXISTS` 過濾）
  - Depends on: 3.6
  - Independence: serial
  - status: not_started

- [ ] 3.8 更新 `lib/db/schema.ts`：移除 `routes.region` 對應欄位（與 migration 0008 對齊）
  - Acceptance: WHEN typecheck 跑 THEN 0 error AND `Route` 不再含 `region`
  - Depends on: 3.7
  - Independence: serial
  - status: not_started

- [ ] 3.9 新增 `components/RouteRegions.tsx`（generic 元件，admin form + public detail + admin list 共用）
  - Acceptance: WHEN render `<RouteRegions regions={[]}>` THEN 回傳 `null`（component 完全不渲染） AND WHEN render with `[{level:'county', code:'63000', name:'台北市'}, {level:'township', parent_code:'63000', name:'中正區'}]` THEN 輸出文字段落 `台北市 — 中正區`（縣市以 Inter Medium + 森綠強調、鄉鎮以 Inter Regular + 墨黑、連字號 ` — ` 區隔）AND 多縣市時逐行 stack（每縣市一段）
  - Depends on: 3.4
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.10 重構 `features/admin-routes/actions/createRoute.ts` 為 explicit `db.transaction`：INSERT routes returning id → `detectRegions` → INSERT `route_admin_units`；任一失敗整段 rollback；既有 Storage rollback 機制沿用
  - Acceptance: WHEN createRoute 以 polygon-intersecting GPX 成功 THEN `route_admin_units` 有對應 rows AND WHEN spatial query 拋例外 THEN routes INSERT 同 transaction rollback AND Storage 物件 best-effort 移除 AND `_form` alert 顯示 `行政區判斷失敗：{message}`
  - Depends on: 3.8
  - Independence: serial
  - status: not_started

- [ ] 3.11 更新 `features/admin-routes/actions/__tests__/createRoute.integration.test.ts`：加 transaction rollback 與 join rows 斷言
  - Acceptance: WHEN integration 測試跑 THEN 成功 path 驗證 `route_admin_units` rows AND mock spatial query 失敗 path 驗證 routes row 與 Storage 物件皆不存在
  - Depends on: 3.10
  - Independence: serial
  - status: not_started

- [ ] 3.12 更新 `features/admin-routes/types.ts` 與 `RouteMetadataForm.tsx`：刪 `region` 欄、加 `routeRegions?: Region[]` prop、render `<RouteRegions>` read-only
  - Acceptance: WHEN admin form render（含 preview 階段）THEN 沒有 `id="region"` 的 `<input>` AND `routeRegions` 非空時 render `<RouteRegions>`；空陣列或 undefined 時整段「途經區域」section 不渲染
  - Depends on: 3.9, 3.10
  - Independence: serial
  - status: not_started

- [ ] 3.13 更新 `features/admin-routes/UploadPageClient.tsx`（preview 階段 chips 為空 / 上傳成功後從 server response 帶 detected regions）與 `EditPageClient.tsx`（server-loaded `detectedRegions` 傳入 form）
  - Acceptance: WHEN edit 頁 SSR THEN `<RegionMetadataForm routeRegions={detected} />` 顯示該 route 已存的 regions AND upload 頁 preview phase 不嘗試 client-side detect
  - Depends on: 3.12
  - Independence: serial
  - status: not_started

- [ ] 3.14 更新 `features/admin-routes/RouteList.tsx` 與 `routeListView.ts`：`region` 欄改顯示 RouteRegions 單行壓縮 `{縣市} {鄉鎮…} / {縣市} {鄉鎮…}` 並 CSS truncate（`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`）
  - Acceptance: WHEN admin route list render THEN 每 row region 欄顯示單行壓縮文字並截斷 AND 0 region 顯示 `—` AND view-model `routeListView` 輸出含 `regions: Region[]`
  - Depends on: 3.10
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.15 升級 `app/(public)/routes/[slug]/page.tsx`：以 leftJoin 抓 regions、render `<RouteRegions>`（與 B 的 elevation 區塊並存）
  - Acceptance: WHEN visitor 打開已 published route detail THEN regions chip 區塊在頁面上 AND 0 region 時不渲染整塊
  - Depends on: 3.9, 2.8
  - Independence: serial
  - status: not_started

- [ ] 3.16 更新 `app/(public)/routes/page.tsx`：`REGION_FILTERS` 從 SSR 查 admin_units（county level + EXISTS published intersecting）取代 hardcoded 6 值
  - Acceptance: WHEN public 列表頁 SSR THEN region filter 列出至少一條 published route 對應的 county AND 0 published time THEN 顯示空 filter list（不顯示 hardcoded 預設）
  - Depends on: 3.10
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.17 更新 `app/(admin)/admin/routes/page.tsx`：列表 query 加入 join admin_units 與 route_admin_units 給 `<RouteList>` 顯示 chips
  - Acceptance: WHEN admin 列表 SSR THEN 每 row 帶 detected regions 給 `RouteList`
  - Depends on: 3.14
  - Independence: serial
  - status: not_started

- [ ] 3.18 新增 e2e fixtures：`e2e/fixtures/taipei-loop.gpx`（跨中正/大安兩區短迴圈）與 `offshore.gpx`（全在海上）
  - Acceptance: WHEN parseGpx 載 `taipei-loop.gpx` THEN bbox 在台北市範圍 AND WHEN 載 `offshore.gpx` THEN bbox 在海面區域
  - Depends on: 3.5
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.19 更新 `e2e/helpers/seed.ts`：加 `seedAdminUnits()` / `clearAdminUnits()` helper；`seedRoute` 簽章不再含 `region` / `difficulty` / `durationS`；如有需要在 test 開頭重 seed taipei admin_units
  - Acceptance: WHEN tests 引用 `seedRoute` THEN compiles cleanly AND `seedAdminUnits([{code, level, name, geom}])` 可寫入 fixture rows
  - Depends on: 3.6
  - Independence: serial
  - status: not_started

- [ ] 3.20 更新 `e2e/admin-routes-upload.spec.ts`：上傳 `taipei-loop.gpx` 後斷言 admin form 顯示「途經區域」section 含至少 1 個縣市文字；published 後造訪 public detail 頁亦見對應文字
  - Acceptance: WHEN upload spec 跑 THEN admin form 在上傳成功後「途經區域」section 文字含 seed 縣市名（如 "台北市"）AND public detail 頁同樣顯示
  - Depends on: 3.18, 3.19, 3.13, 3.15
  - Independence: serial
  - status: not_started

- [ ] 3.21 新增 或更新 `e2e/public-routes-list.spec.ts`：seed 兩條跨不同 county 的 published route，斷言 filter list 動態包含這兩個 county name
  - Acceptance: WHEN spec 跑 THEN public list 頁 filter 列含 seed 對應的 county name AND 不含未 seed 的 hardcoded 舊值
  - Depends on: 3.16, 3.19, 3.18
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.22 更新 `e2e/admin-routes-edit.spec.ts`：斷言 edit 頁顯示 read-only RouteRegions
  - Acceptance: WHEN edit spec 跑 THEN form 顯示 `<RouteRegions>` 至少 1 個縣市文字段落 AND 沒有可填的 region input
  - Depends on: 3.13
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.23 更新 `docs/data-model.md` 反映 final schema（routes 欄位差異 + admin_units + route_admin_units + RLS）
  - Acceptance: WHEN reader 讀 `docs/data-model.md` THEN 看到 routes 不再含 difficulty/duration_s/region AND 看到 admin_units / route_admin_units 詳細欄位與 RLS 段落
  - Depends on: 3.8
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.24 新增 `docs/runbooks/admin-units-refresh.md`：年改 SHP 重新匯入流程
  - Acceptance: WHEN reader 讀 runbook THEN 看到下載 SHP → 跑 build-admin-units-geojson script → 新 migration（TRUNCATE + 重 seed + 重 detect all routes）的步驟
  - Depends on: 3.1
  - Independence: parallel-safe
  - status: not_started

- [ ] 3.25 C 段 verification：`pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
  - Acceptance: WHEN 四個指令依序執行 THEN 全部 exit 0
  - Depends on: 3.20, 3.21, 3.22, 3.23, 3.24
  - Independence: serial
  - status: not_started

## 4. Final verification（整個 change 完成後）

- [ ] 4.1 `openspec validate --strict` 通過
  - Acceptance: WHEN `openspec validate feat-gpx-driven-route-metadata --strict` 跑 THEN exit 0 AND 無 warning
  - Depends on: 3.25
  - Independence: serial
  - status: not_started

- [ ] 4.2 視覺與 deferred 驗證（含 Figma 對齊與 detail 頁實機檢視）由 `spec-driven-dev:verification-before-completion` 主導
  - Acceptance: WHEN verification-before-completion 跑完 THEN 產出 `openspec/changes/feat-gpx-driven-route-metadata/verification-report.md` AND 報告中 5 個 staged check 全 pass
  - Depends on: 4.1
  - Independence: serial
  - status: not_started

## Optional artifacts

- [ ] PlantUML diagrams (spec-driven-dev:writing-uml)
- [x] Figma designs (spec-driven-dev:writing-figma) — 預計覆蓋：公開 detail 頁版面（含 `<ElevationProfile>` + `<RouteRegions>` 區塊）、`<RouteRegions>` variant set（admin form / public detail / admin list 三處）、公開列表頁 `REGION_FILTERS` 動態狀態（0 / N / M county）
