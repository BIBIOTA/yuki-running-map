---
change_id: refresh-taiwan-admin-units
doc_language: zh-TW
---

# refresh-taiwan-admin-units — Design

## 1. 問題陳述（Why）

本機 `admin_units` 表只有 5 筆 stub fixture（2 縣市 + 3 鄉鎮），是 `feat-gpx-driven-route-metadata` 留下的 placeholder。實際 GPX 落在 stub 涵蓋範圍外（例如新北市瑞芳區）時，`previewRegions` 與 `createRoute.detectRegions` 都會回 0 個 intersect → UI 顯示「此路線未涵蓋任何已知行政區」即使這條路線真的有歸屬縣市。

完整的 debug 記錄見 `openspec/changes/refactor-upload-metadata-fields/debugging-report.md`。簡述 root cause：

- PostGIS direct probe with `(lon=121.82194, lat=25.10283)` returns 0 rows.
- 表內只 5 筆，瑞芳區根本不存在。
- 新北市 stub polygon 東邊到 lon=121.45 就斷了。
- Seed 檔 `lib/db/migrations/seed/taiwan-admin-units.geojson` 只有 2.5 KB（真實資料是好幾 MB）。
- Runbook `docs/runbooks/admin-units-refresh.md` 寫了刷新流程但從沒被執行過。

→ `previewRegions` / `detectRegions` / spec 都正確；缺的是真實資料。

## 2. Scope（What）

本變更執行 `docs/runbooks/admin-units-refresh.md` 的全部步驟，把 admin_units 從 5 筆 stub 換成真實資料：

| 動作 | 範圍 |
| --- | --- |
| **加** | `scripts/refresh-admin-units.ts` — 一鍵下載 + 合併 + normalise wrapper script |
| **加** | `lib/db/migrations/0010_refresh_taiwan_admin_units.sql` — TRUNCATE CASCADE + INSERT 真實資料 + 重抓所有 routes |
| **覆寫** | `lib/db/migrations/seed/taiwan-admin-units.geojson` — 真實 ~390 features 取代 5 筆 stub |
| **微調** | `lib/regions/normalizeAdminUnits.ts` — 接受 g0v 的 `COUNTYSN`/`TOWNSN` 作為 `COUNTYCODE`/`TOWNCODE` 的 fallback |
| **更新** | `docs/runbooks/admin-units-refresh.md` — 主來源改 g0v，GDAL/SHP 改為 alternate |
| **更新** | `lib/db/migrations/meta/_journal.json` — 註冊 0010 entry |

不在 scope 內：
- 自動化 cron / GitHub Action 偵測 g0v 更新（YAGNI）。
- 寫一個 SHP parser dep。
- 動 runtime 程式碼（previewRegions / detectRegions / RouteRegions / UploadPageClient 全部不動）。
- 寫前端 UI（regions slot 在 `refactor-upload-metadata-fields` 已完成）。

## 3. 推薦方案 vs 替代方案

### 推薦：把 admin_units refresh 當成獨立的「下載 → 正規化 → migration」管線

- 既有 `scripts/build-admin-units-geojson.ts` + `normalizeAdminUnits` 已備好；只需要微調 fallback + 加 wrapper script 把「下載 g0v + 合併 county/township + normalise」串成一行。
- migration 結構鏡像 0007（jsonb literal 內嵌）+ rolling backfill route_admin_units。
- 無新 npm dep；wrapper 用 Node 22 native `fetch`。

**為什麼推薦**：
- runbook 與 normaliser 都已備好，這個變更主要是「執行 runbook」而非「新建系統」。
- 微調 normaliser fallback 是最小手術。
- 一鍵 wrapper 避免年度刷新時手動打字錯。

### 替代方案 A — 每次手動執行 runbook 每一步

**拒絕**：runbook 7 步任何一步打字錯都會壞；wrapper script 是用最低 cost 把易錯步驟自動化。

### 替代方案 B — GitHub Action 自動偵測 g0v 更新並開 PR

**拒絕，YAGNI**：g0v 鏡像更新頻率低（縣市 2010 / 鄉鎮 1982 多年未變），每年一次人工跑就夠了。

### 替代方案 C — 裝 GDAL 跑 SHP → GeoJSON

**拒絕當主流程**：要求 contributor `brew install gdal`（~500 MB 依賴），門檻太高。runbook 註明為 alternate path（當需要絕對最新 vintage 時）。

## 4. 架構

```
contributor
   ↓ pnpm tsx scripts/refresh-admin-units.ts        ★ new
       ├─ fetch g0v/twCounty2010.geo.json → /tmp/refresh-admin-units/_county.json
       ├─ fetch g0v/twTown1982.geo.json   → /tmp/refresh-admin-units/_town.json
       ├─ merge → FeatureCollection (22 county + ~370 township)
       ├─ normalizeAdminUnits(merged)              (existing + COUNTYSN fallback)
       └─ writeFile lib/db/migrations/seed/taiwan-admin-units.geojson
   ↓ contributor 手動寫 migration（runbook 步驟 3）：
       lib/db/migrations/0010_refresh_taiwan_admin_units.sql
       lib/db/migrations/meta/_journal.json
   ↓ pnpm db:migrate
       └─ TRUNCATE admin_units CASCADE
       + INSERT ~392 features (ST_MakeValid)
       + INSERT route_admin_units backfill via ST_Intersects
   ↓ contributor commits all 4 changed files
```

Runtime（previewRegions / createRoute / RouteRegions / UploadPageClient / EditPageClient）**完全不變**。

## 5. 元件職責

### 不動

- `lib/regions/normalizeAdminUnits.ts` 的主邏輯（Polygon → MultiPolygon、雙層 fallback、orphan 偵測）
- `lib/regions/types.ts`（`Region` 型別）
- `lib/admin-routes/detectRegions.ts`（PostGIS ST_Intersects helper）
- `features/admin-routes/actions/previewRegions.ts`（Server Action）
- `components/RouteRegions.tsx`、`features/admin-routes/UploadPageClient.tsx`、`features/admin-routes/EditPageClient.tsx`
- `scripts/build-admin-units-geojson.ts`（仍可手動使用；wrapper 是它的便利包裝）

### 微調

| 檔案 | 修改 |
| --- | --- |
| `lib/regions/normalizeAdminUnits.ts` | `readString(props, "COUNTYCODE")` 在缺失時 fallback 到 `COUNTYSN`；township 加 `TOWNSN` fallback。註解標明這是為了相容 g0v 鏡像（[github.com/g0v/twgeojson](https://github.com/g0v/twgeojson)）。 |
| `docs/runbooks/admin-units-refresh.md` | (a) 主來源改 g0v + 附 curl URL；(b) GDAL/SHP 路徑記為 alternate；(c) 註明 g0v vintage 偏舊但行政變更稀少。 |

### 新增

| 檔案 | 內容 |
| --- | --- |
| `scripts/refresh-admin-units.ts` | Node script，三步串成一行：(1) `fetch` g0v 兩個 GeoJSON 到 tmpdir；(2) 合併為 FeatureCollection；(3) `normalizeAdminUnits()` + writeFile 到 seed path。不寫 migration（仍由 contributor 手動產出）。 |
| `lib/db/migrations/0010_refresh_taiwan_admin_units.sql` | TRUNCATE admin_units CASCADE → 內嵌新 GeoJSON jsonb literal → `ST_MakeValid` INSERT → 重抓所有 routes 的 route_admin_units。 |
| `lib/db/migrations/seed/taiwan-admin-units.geojson` | 重新生成（覆寫 stub）。git diff 會很大但 one-off。 |
| `lib/db/migrations/meta/_journal.json` | 新增第 10 個 entry（`0010_refresh_taiwan_admin_units`）。 |

### 不刪

5-row stub seed 直接被新版覆寫；rollback 走 git history。

## 6. 資料流

### 一次性 refresh pipeline

```
[1] pnpm tsx scripts/refresh-admin-units.ts
[2] script 內部:
    fetch g0v/twCounty2010.geo.json   ~9.3 MB
    fetch g0v/twTown1982.geo.json     ~20 MB
    merged = { type:"FeatureCollection", features:[...county, ...town] }
    normalised = normalizeAdminUnits(merged)
      ├─ 22 county   → { code: COUNTYSN,  level:"county",    name: COUNTYNAME, parent_code: null }
      └─ ~370 town   → { code: TOWNSN,    level:"township",  name: TOWNNAME,    parent_code: COUNTYSN }
    writeFile lib/db/migrations/seed/taiwan-admin-units.geojson
    stdout: "Wrote 392 features ..."

[3] contributor: 手動寫 0010 migration (runbook template)
[4] pnpm db:migrate
[5] migration 內部 (single transaction):
    TRUNCATE TABLE admin_units CASCADE          → 也清空 route_admin_units
    INSERT INTO admin_units 392 rows            (ST_MakeValid + cast to MultiPolygon)
    INSERT INTO route_admin_units               (ST_Intersects join over all routes)
[6] verify in psql:
    SELECT level, COUNT(*) FROM admin_units GROUP BY level;
    → county 22, township 360~380
[7] smoke: 重拖 GPX 上 /admin/upload
    → regions slot 顯示「新北市 — 瑞芳區」段落
```

### 運行時不變

- `previewRegions(geometry)` 不變 — 對 `admin_units` 跑 ST_Intersects，資料變多後直接回真實 region。
- `createRoute` 的 in-transaction `detectRegions` 也不變。
- `<RouteRegions>` / `<RouteRegionsSection>` / `routeRegionsView` 收到真實 region 直接渲染段落（既有 paragraph chrome）。

### 關鍵設計選擇

- **TRUNCATE CASCADE > UPDATE**：行政區偶爾被合併/拆分；identity-preserving UPDATE 太脆弱。
- **route_admin_units 重抓在同一交易內**：避免 admin_units 換掉但 routes 還指向舊 unit_id 的不一致瞬間。
- **`refresh-admin-units.ts` 不寫 migration**：保持 seed 與 migration 是兩段（runbook 既有約定）。
- **fetch 用 native `fetch`**：repo Node ≥ 22，不引入 axios / undici。

## 7. 錯誤處理

### Refresh script

| 來源 | 表現 | 對使用者 |
| --- | --- | --- |
| g0v 5xx / timeout | `process.exit(1)` + `failed to fetch <url>: <reason>` | 重跑（網路恢復）或自行下載塞到 tmpdir 再跑 |
| g0v 200 但 body 非合法 JSON | exit 1 + `g0v response was not valid JSON; got first 200 chars: ...` | g0v repo 結構變了 → 查 github.com/g0v/twgeojson 後手動更新 script |
| FeatureCollection 缺 county/township | `normalizeAdminUnits` throw → exit 1 | g0v 命名約定變了 → 修 normaliser fallback list |
| County 數不為 22 | `stderr.warn` 但不 fail（允許未來 6 都改制）+ `note: expected 22 counties, got N` | contributor 判斷是否合理 |

### Migration

| 來源 | 表現 |
| --- | --- |
| 重複 apply | 不會發生（drizzle journal 記著只跑一次） |
| `ST_MakeValid` 修不掉的 polygon | PG throw → 交易 rollback → `pnpm db:migrate` 退非 0 |
| `INSERT route_admin_units` 0 intersect | 正常（離島 / 跨界）— 不 throw |
| TRUNCATE CASCADE 影響到正在跑的 query | 本機 dev 場景；contributor 應在 pnpm dev 停掉時跑 |

### Rollback

- 不可逆（TRUNCATE）。runbook 既有 rollback 章節：rollback path 是「重新跑 0009 後手動 INSERT 舊 stub」（或 git revert 後重跑）。
- **只對 local Supabase 跑這個 migration**，正式環境 deploy 走 Vercel/Supabase CI（既有慣例）。runbook 加註此提示。

### Runtime

完全不變。previewRegions 0 intersect → `{ ok: true, regions: [] }`（離島合理空集）；throw → `{ ok: false, message: '行政區預覽暫時無法使用' }`。

## 8. 測試策略

### 單元測試（vitest, node）

| 檔案 | 涵蓋 |
| --- | --- |
| `lib/regions/__tests__/normalizeAdminUnits.test.ts` | 新增：(a) county 用 `COUNTYSN` fallback；(b) township 用 `TOWNSN`/`TOWNNAME` + `COUNTYSN` parent fallback。 |
| `lib/db/__tests__/migration0010.test.ts`（新增）| 同 0008/0009 pattern：assert 檔存在、含 `TRUNCATE TABLE admin_units CASCADE` + `INSERT INTO admin_units` + `INSERT INTO route_admin_units` + journal 註冊。 |

### Integration 測試（可選；DATABASE_URL-gated）

| 檔案 | 涵蓋 |
| --- | --- |
| `lib/admin-routes/__tests__/previewRegions.integration.test.ts`（**可選**新增）| 對遷移後 DB 跑：以 `(121.82194, 25.10283)` 的 LineString 呼叫 `previewRegions` → 預期 regions 含 `新北市` + `瑞芳區`。是 root-cause 真實證據。 |

### Smoke 驗收（手動 + dev server）

1. `pnpm tsx scripts/refresh-admin-units.ts` → stdout 印「Wrote ~392 features ...」
2. 手動寫 migration 0010、更新 journal
3. `pnpm db:migrate` → `migrations applied successfully!`
4. `psql -c "SELECT level, COUNT(*) FROM admin_units GROUP BY level;"` → county 22, township 360~380
5. `psql -c "SELECT name FROM admin_units WHERE name = '瑞芳區';"` → 1 row
6. `/admin/upload` 重拖 `Afternoon_Run.gpx` → regions slot 顯示「新北市 — 瑞芳區」段落，`data-state="ready"`

### 取捨

- **不寫 React component 測試**：CLAUDE.md「no new deps」+ 既有約定（vitest node-only）。整段 refresh 的真正驗證在 step 6。
- **integration test 標 optional**：完整 DB-gated 整合測試需要 8 MB GeoJSON parse 才能 seed test DB。先靠 smoke + unit；user 覺得需要可獨立加。
- **g0v fetch 不寫 retry**：失敗就讓 contributor 重跑 script。網路重試邏輯 YAGNI。

## 9. Probable next steps

- **UML**：不走 `spec-driven-dev:writing-uml`。資料流在 §6 的 ASCII pipeline 寫清楚；無複雜 state machine 或 cross-component 互動。
- **Figma**：不走 `spec-driven-dev:writing-figma`。本變更是純資料層刷新，UI 完全不動；regions slot 的視覺規格已在 `refactor-upload-metadata-fields/designs/figma.md` 拍板。

## 10. 開放問題

無。已釐清：

- 資料來源 = g0v GeoJSON 鏡像（22 縣市 + ~370 鄉鎮）
- migration 內嵌 = jsonb literal（跟 0007 一致，~30 MB SQL）
- backfill 範圍 = 全部 routes（不分 published/草稿，與 0008 一致）
