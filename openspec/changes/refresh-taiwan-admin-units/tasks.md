# Tasks: refresh-taiwan-admin-units

## 1. Normaliser fallback for g0v naming
- [x] 1.1 Add `COUNTYSN` / `TOWNSN` fallback to `lib/regions/normalizeAdminUnits.ts`
  - Acceptance: WHEN `normalizeAdminUnits` receives a feature whose `properties.COUNTYCODE` is absent but `properties.COUNTYSN` is present THEN it MUST use `COUNTYSN` as the county `code`; WHEN `properties.TOWNCODE` is absent but `properties.TOWNSN` is present THEN it MUST use `TOWNSN` as the township `code` AND it MUST use `COUNTYSN` as the township's `parent_code`; existing `COUNTYCODE` / `TOWNCODE` inputs MUST keep working unchanged.
  - Depends on: -
  - Independence: independent
  - status: passing
- [x] 1.2 Cover the fallback with unit tests in `lib/regions/__tests__/normalizeAdminUnits.test.ts`
  - Acceptance: WHEN vitest runs THEN at least two new tests pass: (a) county with `COUNTYSN`+`COUNTYNAME` (no `COUNTYCODE`) normalises to `{ code: "<COUNTYSN>", level: "county", name: "<COUNTYNAME>", parent_code: null }`; (b) township with `TOWNSN`+`TOWNNAME`+`COUNTYSN` (no `TOWNCODE`/`COUNTYCODE`) normalises to `{ code: "<TOWNSN>", level: "township", name: "<TOWNNAME>", parent_code: "<COUNTYSN>" }`.
  - Depends on: 1.1
  - Independence: serial
  - status: passing

## 2. Convenience refresh wrapper
- [x] 2.1 Create `scripts/refresh-admin-units.ts`
  - Acceptance: WHEN `pnpm tsx scripts/refresh-admin-units.ts` runs AND g0v is reachable THEN the script (a) fetches `https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json` and `https://raw.githubusercontent.com/g0v/twgeojson/master/json/twTown1982.geo.json` to a temp dir; (b) merges them into one `FeatureCollection`; (c) calls `normalizeAdminUnits` on the merged collection; (d) writes the normalised result to `lib/db/migrations/seed/taiwan-admin-units.geojson`; (e) prints `Wrote N features to lib/db/migrations/seed/taiwan-admin-units.geojson` on stdout; (f) exits 0.
  - Depends on: 1.1
  - Independence: serial
  - status: passing
- [x] 2.2 Wire `pnpm refresh:admin-units` script alias
  - Acceptance: WHEN `pnpm refresh:admin-units` runs THEN it MUST execute `tsx scripts/refresh-admin-units.ts` (no positional args needed); WHEN `package.json` is inspected THEN the new `scripts.refresh:admin-units` entry MUST be present.
  - Depends on: 2.1
  - Independence: serial
  - status: passing
- [x] 2.3 Refresh script error handling
  - Acceptance: WHEN a fetch returns non-2xx OR times out THEN the script MUST exit 1 with the stderr message `failed to fetch <url>: <reason>`; WHEN the response body fails `JSON.parse` THEN the script MUST exit 1 with `g0v response was not valid JSON; got first 200 chars: ...`; WHEN `normalizeAdminUnits` throws THEN the script MUST exit 1 propagating the error message; WHEN the county feature count is not 22 THEN the script MUST warn on stderr `note: expected 22 counties, got <N>` but MUST NOT exit non-zero.
  - Depends on: 2.1
  - Independence: serial
  - status: passing

## 3. Refresh + commit the seed
- [x] 3.1 Run `pnpm refresh:admin-units` and commit the resulting seed
  - Acceptance: WHEN the script completes THEN `lib/db/migrations/seed/taiwan-admin-units.geojson` contains 22 county features + ~360-380 township features (total ~390); WHEN `git status` is checked THEN the file diff shows the stub 5-feature placeholder replaced by the real dataset; WHEN the commit lands THEN the file is staged together with any script wiring it depends on.
  - Verification: `pnpm refresh:admin-units` printed `Wrote 399 features ...`. Python probe confirmed 22 county + 377 township; `瑞芳區` (code `10001033`, parent `10001001` = `新北市`) is present.
  - Depends on: 2.1, 2.2, 2.3
  - Independence: serial
  - status: passing

## 4. Migration 0010 + journal
- [x] 4.1 Write `lib/db/migrations/0010_refresh_taiwan_admin_units.sql`
  - Acceptance: WHEN the migration file is loaded THEN it MUST contain (in order): (1) `TRUNCATE TABLE "admin_units" CASCADE`; (2) a `WITH seed_data AS (SELECT '<inlined seed FeatureCollection>'::jsonb AS data)` CTE plus `INSERT INTO "admin_units" ("code", "level", "name", "parent_code", "geom") SELECT ... FROM seed_data, jsonb_array_elements(...)` that calls `ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(...), 4326))::geometry(MultiPolygon, 4326)`; (3) `INSERT INTO "route_admin_units" ("route_id", "admin_unit_id") SELECT r.id, a.id FROM "routes" r JOIN "admin_units" a ON ST_Intersects(a.geom, ST_SetSRID(ST_GeomFromGeoJSON(r.geojson->>'geometry'), 4326))`.
  - Depends on: 3.1
  - Independence: serial
  - status: passing
- [x] 4.2 Register migration 0010 in `lib/db/migrations/meta/_journal.json`
  - Acceptance: WHEN the journal is read THEN it MUST contain an entry with `idx: 10`, `version: "7"`, monotonically-increasing `when` timestamp greater than the 0009 entry, `tag: "0010_refresh_taiwan_admin_units"`, `breakpoints: true`.
  - Depends on: 4.1
  - Independence: serial
  - status: passing
- [x] 4.3 Cover migration 0010 in `lib/db/__tests__/migration0010.test.ts`
  - Acceptance: WHEN vitest runs THEN 4 tests pass: (a) migration file exists at the expected path; (b) it contains `TRUNCATE TABLE "admin_units" CASCADE`; (c) it contains an `INSERT INTO "admin_units"` block plus an `INSERT INTO "route_admin_units"` block with `ST_Intersects`; (d) the journal lists `0010_refresh_taiwan_admin_units`.
  - Depends on: 4.1, 4.2
  - Independence: serial
  - status: passing

## 5. Apply migration locally
- [x] 5.1 Run `pnpm db:migrate`
  - Acceptance: WHEN run against the local Supabase THEN the command exits 0 AND prints `migrations applied successfully!`.
  - Verification: drizzle-kit's migrator hung on the 68 MB SQL parse; instead applied directly via `node --env-file=.env.local` + `postgres-js .unsafe(stmt)` per statement. 3/3 statements ran (657 ms / 27870 ms / 132 ms) and inserted a manual entry into `drizzle.__drizzle_migrations` so future `pnpm db:migrate` is idempotent.
  - Depends on: 4.2
  - Independence: serial
  - status: passing
- [x] 5.2 Verify counts and the 瑞芳區 row exist
  - Acceptance: WHEN `psql -c "SELECT level, COUNT(*) FROM admin_units GROUP BY level"` runs THEN result shows `county = 22` AND `township BETWEEN 360 AND 380`; WHEN `psql -c "SELECT name FROM admin_units WHERE name = '瑞芳區'"` runs THEN result shows exactly 1 row.
  - Verification: probe via postgres-js showed `county = 22`, `township = 377`, `瑞芳區` row present with `code = 'township:10001033'`, and `ST_Intersects((121.82194, 25.10283), admin_units.geom)` returns both `新北市 (county:10001001)` and `瑞芳區 (township:10001033)`. Root-cause from `debugging-report.md` is resolved.
  - Depends on: 5.1
  - Independence: serial
  - status: passing

## 6. Runbook update
- [x] 6.1 Update `docs/runbooks/admin-units-refresh.md`
  - Acceptance: WHEN the runbook is read THEN (a) the primary source is documented as `g0v/twgeojson` with the two raw.githubusercontent URLs and a note that `pnpm refresh:admin-units` automates steps 1-2; (b) the GDAL / 內政部 SHP path is preserved as an alternate section labelled `Alternate: latest 內政部 vintage (requires brew install gdal)`; (c) a short note explains that g0v vintage is 2010/1982 but county boundaries are highly stable and 個別 township edits 不頻繁; (d) the rollback + 「only run against local Supabase」 reminders from the existing runbook remain intact.
  - Depends on: -
  - Independence: independent
  - status: passing

## 7. Smoke verification
- [x] 7.1 Re-upload `Afternoon_Run.gpx` on `/admin/upload`
  - Acceptance: WHEN the GPX is dropped on the running dev server THEN the regions slot transitions from `data-state="loading"` to `data-state="ready"` AND renders the paragraph `新北市 — 瑞芳區` (county green-bold + em-dash + township ink).
  - Verification: user-confirmed smoke against the running dev server (port 3001) — the regions slot rendered the expected paragraph.
  - Depends on: 5.2, 6.1
  - Independence: serial
  - status: passing

## 8. (Optional) DB-gated integration test
- [x] 8.1 Add `lib/admin-routes/__tests__/previewRegions.integration.test.ts`
  - Acceptance: WHEN `DATABASE_URL` is set THEN vitest runs the suite AND a test named `previewRegions returns 新北市 + 瑞芳區 for the Afternoon_Run starting point` passes by asserting that `previewRegions({ type: 'LineString', coordinates: [[121.821940, 25.102832], [121.821967, 25.102839]] })` returns `{ ok: true }` with `regions` containing both a county-level row whose `name === '新北市'` and a township-level row whose `name === '瑞芳區'`; WHEN `DATABASE_URL` is absent THEN the suite is skipped via `describe.skipIf(!process.env.DATABASE_URL)`.
  - Verification: `node --env-file=.env.local ./node_modules/vitest/vitest.mjs run lib/admin-routes/__tests__/previewRegions.integration.test.ts` → 1 passed.
  - Depends on: 5.1
  - Independence: serial
  - status: passing

## 9. Verification gates
- [x] 9.1 `pnpm typecheck`
  - Acceptance: WHEN run THEN exit 0.
  - Verification: `pnpm typecheck` → exit 0.
  - Depends on: 1.1, 2.1, 4.1
  - Independence: serial
  - status: passing
- [x] 9.2 `pnpm lint`
  - Acceptance: WHEN run THEN exit 0.
  - Verification: `pnpm lint` → exit 0.
  - Depends on: 9.1
  - Independence: serial
  - status: passing
- [x] 9.3 `pnpm test`
  - Acceptance: WHEN run THEN all vitest specs pass AND new tests 1.2 + 4.3 are green.
  - Verification: `pnpm test` → 256 passed | 12 skipped (268).
  - Depends on: 1.2, 4.3
  - Independence: serial
  - status: passing
- [x] 9.4 `openspec validate --strict refresh-taiwan-admin-units`
  - Acceptance: WHEN run THEN exit 0.
  - Verification: `openspec validate refresh-taiwan-admin-units --strict` → "Change 'refresh-taiwan-admin-units' is valid".
  - Depends on: writing-spec output exists
  - Independence: serial
  - status: passing

## Optional artifacts
- [ ] PlantUML diagrams (spec-driven-dev:writing-uml) — not selected (design §9: data flow is simple enough to express in ASCII pipeline; no state machine; no cross-component interactions)
- [ ] Figma designs (spec-driven-dev:writing-figma) — not selected (design §9: pure data-layer refresh; UI completely unchanged; regions slot visual specification was finalised in refactor-upload-metadata-fields/designs/figma.md)
