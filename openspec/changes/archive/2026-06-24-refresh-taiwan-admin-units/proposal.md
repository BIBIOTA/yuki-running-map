## Why

本機 `admin_units` 表只有 5 筆 stub fixture（2 縣市 + 3 鄉鎮），是 `feat-gpx-driven-route-metadata` 留下的 placeholder。實際 GPX 落在 stub 涵蓋範圍外（例如新北市瑞芳區）時，`previewRegions` 與 `createRoute.detectRegions` 都回 0 個 intersect → UI 顯示「此路線未涵蓋任何已知行政區」即使這條路線真的有歸屬縣市。

完整 root-cause 證據見 `openspec/changes/refactor-upload-metadata-fields/debugging-report.md`：

- PostGIS direct probe with `(lon=121.82194, lat=25.10283)` returns 0 rows.
- 表內只 5 筆，瑞芳區根本不存在。
- 新北市 stub polygon 東邊到 lon=121.45 就斷了。
- Seed 檔 `lib/db/migrations/seed/taiwan-admin-units.geojson` 只有 2.5 KB（真實資料是好幾 MB）。
- Runbook `docs/runbooks/admin-units-refresh.md` 寫了刷新流程但從沒被執行過。

→ `previewRegions` / `detectRegions` / spec 都正確；缺的是真實資料。

## What Changes

- **route-administrative-regions**:
  - MODIFIED `lib/regions/normalizeAdminUnits.ts` — 接受 g0v 鏡像的 `COUNTYSN` / `TOWNSN` 作為 `COUNTYCODE` / `TOWNCODE` 的 fallback。
  - ADDED `scripts/refresh-admin-units.ts` 與 `pnpm refresh:admin-units` alias — 一鍵 fetch g0v GeoJSON、合併、normalise、寫回 `lib/db/migrations/seed/taiwan-admin-units.geojson`。
  - REPLACED `lib/db/migrations/seed/taiwan-admin-units.geojson` — 由 5 筆 stub 覆寫為真實的 22 縣市 + ~370 鄉鎮資料。
  - ADDED `lib/db/migrations/0010_refresh_taiwan_admin_units.sql` — `TRUNCATE TABLE admin_units CASCADE` → 內嵌新 GeoJSON jsonb literal + `ST_MakeValid` INSERT → 重抓所有 routes 的 `route_admin_units`。
  - MODIFIED `docs/runbooks/admin-units-refresh.md` — 主來源改 g0v + 註明 `pnpm refresh:admin-units` 自動化前兩步；GDAL / 內政部 SHP 路徑改為 alternate section。

## Impact

- **Affected specs**:
  - `specs/route-administrative-regions/`
- **Affected code**:
  - `lib/regions/normalizeAdminUnits.ts`（小幅 fallback 修改）
  - `scripts/refresh-admin-units.ts`（new）
  - `lib/db/migrations/0010_refresh_taiwan_admin_units.sql`（new）
  - `lib/db/migrations/seed/taiwan-admin-units.geojson`（覆寫）
  - `lib/db/migrations/meta/_journal.json`（新增 0010 entry）
  - `docs/runbooks/admin-units-refresh.md`（更新主來源章節）
  - `package.json`（新增 `refresh:admin-units` script alias）
- **Breaking changes**:
  - **Yes** at the database layer — `TRUNCATE TABLE admin_units CASCADE` 會清空 `route_admin_units` 並重新 INSERT。Release 前需 dump 備份（runbook 既有提示）。本地 dev only；正式環境 deploy 仍走 Vercel/Supabase CI（runbook 強調）。
  - 對外 API、runtime 程式、UI 完全無變更。

## Related Artifacts

### Design

- [design.md](./design.md)
- [tasks.md](./tasks.md)

### Diagrams

無 PlantUML（design.md §9 註記：資料流在 §6 已以 ASCII pipeline 寫清楚；無複雜 state machine 或 cross-component 互動）。

### Figma Designs

無（design.md §9 註記：本變更純資料層刷新、UI 完全不動；regions slot 視覺規格已在 `refactor-upload-metadata-fields/designs/figma.md` 拍板）。
