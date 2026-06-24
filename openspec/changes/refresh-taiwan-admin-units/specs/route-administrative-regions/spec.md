## MODIFIED Requirements

### Requirement: normalizeAdminUnits maps raw 內政部 / g0v properties into the seed shape

The system SHALL provide `normalizeAdminUnits(raw: RawFeatureCollection)` in `lib/regions/normalizeAdminUnits.ts` that maps every raw feature into the seed shape `{ code: string; level: "county" | "township"; name: string; parent_code: string | null }`. The helper SHALL accept both the 內政部 SHP-derived property keys (`COUNTYCODE` / `COUNTYNAME` / `TOWNCODE` / `TOWNNAME`) AND the g0v GeoJSON mirror's property keys (`COUNTYSN` / `TOWNSN`) as code sources, falling back from the official key to the g0v key when the official key is absent. Townships SHALL set `parent_code` to whichever county-code key (`COUNTYCODE` or `COUNTYSN`) is present on the raw feature. `Polygon` geometries SHALL be wrapped into single-element `MultiPolygon`s; `MultiPolygon` geometries SHALL pass through unchanged. Features missing both code sources SHALL cause the helper to throw with a clear error message naming the offending feature.

#### Scenario: County feature falls back to COUNTYSN when COUNTYCODE is absent

- **WHEN** `normalizeAdminUnits` receives a feature with `properties.COUNTYSN = "10014001"`, `properties.COUNTYNAME = "台東縣"`, and no `properties.COUNTYCODE`
- **THEN** the normalised feature SHALL be `{ code: "10014001", level: "county", name: "台東縣", parent_code: null }`

#### Scenario: Township feature falls back to TOWNSN + COUNTYSN

- **WHEN** `normalizeAdminUnits` receives a township feature with `properties.TOWNSN = "10014001001"`, `properties.TOWNNAME = "瑞芳區"`, `properties.COUNTYSN = "10014001"`, and no `TOWNCODE` / `COUNTYCODE`
- **THEN** the normalised feature SHALL be `{ code: "10014001001", level: "township", name: "瑞芳區", parent_code: "10014001" }`

#### Scenario: Existing 內政部 COUNTYCODE / TOWNCODE inputs keep working

- **WHEN** `normalizeAdminUnits` receives a feature with `properties.TOWNCODE`, `properties.TOWNNAME`, and `properties.COUNTYCODE` (no `COUNTYSN` / `TOWNSN`)
- **THEN** the normalised feature SHALL use `TOWNCODE` as `code` AND use `COUNTYCODE` as `parent_code`

## ADDED Requirements

### Requirement: refresh-admin-units convenience wrapper script

The system SHALL provide `scripts/refresh-admin-units.ts`, executable via `pnpm tsx scripts/refresh-admin-units.ts` and via the new `pnpm refresh:admin-units` alias. The script SHALL fetch the g0v Taiwan boundary GeoJSON mirror (county at `https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json` and township at `https://raw.githubusercontent.com/g0v/twgeojson/master/json/twTown1982.geo.json`) into a temp directory, merge the two FeatureCollections into one, call `normalizeAdminUnits` on the merged collection, and write the normalised result to `lib/db/migrations/seed/taiwan-admin-units.geojson`. The script SHALL print `Wrote N features to lib/db/migrations/seed/taiwan-admin-units.geojson` on stdout and exit 0 on success. The script SHALL NOT write a migration file — migration authoring stays a separate manual step per the runbook.

#### Scenario: Successful refresh writes the normalised seed

- **WHEN** `pnpm refresh:admin-units` runs and g0v is reachable
- **THEN** the script SHALL fetch both g0v URLs to a temp directory
- **AND** merge them into one FeatureCollection
- **AND** call `normalizeAdminUnits` on the merged collection
- **AND** write the normalised FeatureCollection to `lib/db/migrations/seed/taiwan-admin-units.geojson`
- **AND** print `Wrote N features to lib/db/migrations/seed/taiwan-admin-units.geojson` on stdout where `N` matches the feature count
- **AND** exit 0

#### Scenario: g0v fetch failure exits 1 with diagnostic message

- **WHEN** the g0v fetch returns a non-2xx status or times out
- **THEN** the script SHALL exit 1
- **AND** print `failed to fetch <url>: <reason>` on stderr

#### Scenario: g0v response is not valid JSON

- **WHEN** the g0v response body fails `JSON.parse`
- **THEN** the script SHALL exit 1
- **AND** print `g0v response was not valid JSON; got first 200 chars: ...` on stderr

#### Scenario: Unexpected county count emits a non-fatal warning

- **WHEN** the merged FeatureCollection's county-level feature count is not 22
- **THEN** the script SHALL warn `note: expected 22 counties, got <N>` on stderr
- **AND** continue to write the seed file
- **AND** exit 0

### Requirement: Migration 0010 replaces stub admin_units with real Taiwan boundaries

The system SHALL provide migration `lib/db/migrations/0010_refresh_taiwan_admin_units.sql` that, in a single transaction, (1) truncates `admin_units` with `CASCADE` so the dependent `route_admin_units` rows are cleared, (2) inserts ~390 normalised admin-unit features (22 counties + ~370 townships) from an inlined GeoJSON `jsonb` literal, applying `ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(...), 4326))::geometry(MultiPolygon, 4326)` to each geometry, and (3) re-detects regions for every route by inserting the `ST_Intersects` join into `route_admin_units` for every `(route, admin_unit)` pair whose simplified line intersects the admin unit's polygon. The migration SHALL be registered in `lib/db/migrations/meta/_journal.json` as `idx: 9`, `tag: "0010_refresh_taiwan_admin_units"`. Migration order MUST be: `TRUNCATE` → `INSERT admin_units` → `INSERT route_admin_units` (the join can only be computed after the new admin_units rows exist).

#### Scenario: Migration truncates, re-seeds, and re-detects

- **WHEN** `pnpm db:migrate` runs migration `0010_refresh_taiwan_admin_units.sql`
- **THEN** `SELECT level, COUNT(*) FROM admin_units GROUP BY level` SHALL show `county = 22` AND `township BETWEEN 360 AND 380`
- **AND** `SELECT name FROM admin_units WHERE name = '瑞芳區'` SHALL return exactly 1 row
- **AND** for every published route whose geojson LineString intersects at least one admin_unit polygon, `route_admin_units` SHALL contain the corresponding `(route_id, admin_unit_id)` row
- **AND** routes whose line intersects zero polygons (offshore / cross-border) SHALL result in zero `route_admin_units` rows for that route (not an error)

#### Scenario: Migration is registered in the journal

- **WHEN** `lib/db/migrations/meta/_journal.json` is read
- **THEN** the entries list SHALL contain `{ idx: 9, version: "7", tag: "0010_refresh_taiwan_admin_units", breakpoints: true }` with a `when` timestamp strictly greater than the 0009 entry

#### Scenario: Migration body order is TRUNCATE → INSERT admin_units → INSERT route_admin_units

- **WHEN** the migration file is loaded
- **THEN** the SQL SHALL contain (in order) `TRUNCATE TABLE "admin_units" CASCADE`, then an `INSERT INTO "admin_units"` block that uses `ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(...), 4326))`, then an `INSERT INTO "route_admin_units"` block whose `WHERE` (or `ON`) clause uses `ST_Intersects`

### Requirement: previewRegions returns real regions after migration 0010

The system SHALL ensure that `previewRegions` (introduced in `refactor-upload-metadata-fields`) returns the correct Taiwan administrative regions for any GPX line in Taiwan after migration 0010 has been applied. Specifically, when called with a LineString whose coordinates fall inside 新北市瑞芳區, `previewRegions` SHALL return `{ ok: true, regions: [...] }` where `regions` contains both a county-level row whose `name === '新北市'` and a township-level row whose `name === '瑞芳區'`.

#### Scenario: Real Taiwan GPX point resolves to county + township

- **WHEN** the local DB has migration 0010 applied
- **AND** `previewRegions({ type: 'LineString', coordinates: [[121.821940, 25.102832], [121.821967, 25.102839]] })` is called
- **THEN** the result SHALL be `{ ok: true, regions: [...] }`
- **AND** `regions` SHALL include a county whose `name === '新北市'`
- **AND** `regions` SHALL include a township whose `name === '瑞芳區'`

#### Scenario: Smoke verification on the running dev server

- **WHEN** a contributor drops `Afternoon_Run.gpx` on `/admin/upload` with the dev server running on the migrated DB
- **THEN** the regions slot SHALL transition from `data-state="loading"` to `data-state="ready"`
- **AND** the rendered DOM SHALL contain the paragraph `新北市 — 新店區、烏來區、瑞芳區` style markup (per the existing `<RouteRegions variant="stacked">` chrome) including the literal substring `瑞芳區`
