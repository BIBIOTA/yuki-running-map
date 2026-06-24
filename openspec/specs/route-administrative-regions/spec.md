# route-administrative-regions Specification

## Purpose
TBD - created by archiving change refactor-upload-metadata-fields. Update Purpose after archive.
## Requirements
### Requirement: previewRegions read-only Server Action returns Region[] from a LineString

The system SHALL provide `previewRegions(geometry: { type: 'LineString'; coordinates: Array<[number, number]> })` as a `"use server"` Server Action in `features/admin-routes/actions/previewRegions.ts`. The Action SHALL call `lib/admin-routes/detectRegions(db, geometry)` to obtain matching `admin_units.id` values and SELECT the corresponding rows from `admin_units` to assemble `Region[]` (fields `code`, `level`, `name`, `parent_code`). The Action SHALL be read-only (no INSERT, no UPDATE, no `revalidatePath`) and SHALL run behind the existing admin middleware. The Action SHALL fold every exception into the discriminated return type `{ ok: true; regions: Region[] } | { ok: false; message: string }`; it SHALL NEVER throw across the client boundary.

#### Scenario: Valid LineString returns the matching regions

- **WHEN** `previewRegions({ type: 'LineString', coordinates: [...] })` is called with a LineString that intersects 1 county + 2 township polygons in `admin_units`
- **THEN** the Action returns `{ ok: true, regions: Region[] }` containing exactly those 3 rows
- **AND** the `Region` objects are well-formed (`code`, `level: 'county' | 'township'`, `name`, `parent_code: string | null`)

#### Scenario: detectRegions throwing surfaces as a tagged error

- **WHEN** the underlying `detectRegions` call throws (e.g. PostGIS / DB error)
- **THEN** `previewRegions` returns `{ ok: false, message: '行政區預覽暫時無法使用' }`
- **AND** the original error is logged via `console.error`
- **AND** no exception crosses the Server Action boundary

#### Scenario: Malformed geometry input is rejected

- **WHEN** `previewRegions` is called with a value whose `type !== 'LineString'` or whose `coordinates` is not a non-empty array of `[number, number]`
- **THEN** the Action returns `{ ok: false, message: '預覽參數錯誤' }`
- **AND** no DB query is issued

> See: ../../designs/figma.md

### Requirement: RouteRegionsSection shared chrome wraps the regions surface across all pages

The system SHALL extract a `<RouteRegionsSection>` component co-located with `<RouteRegions>` in `components/RouteRegions.tsx` whose responsibility is the shared chrome: the `<section aria-labelledby="regions-heading">` wrapper, the 「途經區域」 `<h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">` heading, and the inner slot for the regions body (rendered children OR an inferred `<RouteRegions />` based on the state passed in). The public detail page (`app/(public)/routes/[slug]/page.tsx`), the admin upload preview (`features/admin-routes/UploadPageClient.tsx`), and the admin edit page (`features/admin-routes/EditPageClient.tsx`) SHALL all use `<RouteRegionsSection>` — none SHALL hand-roll its own 「途經區域」 heading.

#### Scenario: Public detail page delegates regions chrome to the shared component

- **WHEN** `/routes/[slug]` renders for a route with one or more regions
- **THEN** the rendered DOM contains exactly one `<h2 id="regions-heading">途經區域</h2>` produced by `<RouteRegionsSection>`
- **AND** the page module no longer hand-rolls the `<section aria-labelledby="regions-heading">` wrapper
- **AND** the inner regions content renders via `<RouteRegions variant="stacked" regions={...} />`

> See: ../../designs/figma.md

#### Scenario: Public detail page hides the section when there are zero regions

- **WHEN** `/routes/[slug]` renders for a route with zero regions
- **THEN** `<RouteRegionsSection>` returns `null` (preserving the existing public-page behaviour)
- **AND** the rendered DOM contains NO 「途經區域」 heading

#### Scenario: RouteMetadataForm no longer owns the regions surface

- **WHEN** `<RouteMetadataForm>` is rendered in either `mode="create"` or `mode="edit"`
- **THEN** the component does NOT render an inline 「途經區域」 block (no `<span className="text-sm font-medium">途經區域</span>` + `<RouteRegions />`)
- **AND** the component's TypeScript props type contains NO `routeRegions` key
- **AND** the parent (`UploadPageClient` / `EditPageClient`) is the surface that renders `<RouteRegionsSection>` beside the form

> See: ../../designs/figma.md

### Requirement: Upload preview RouteRegionsSection renders four state variants

The system SHALL render `<RouteRegionsSection>` on `/admin/upload` with a `data-testid="upload-regions-state"` parent attribute and a `data-state` child attribute that mirrors the `regionsState.kind`. The four variants SHALL match `openspec/changes/refactor-upload-metadata-fields/designs/figma.md` frames 02 / 03 / 04 / 05:

- `loading` → heading + 「正在判斷區域…」 hint + 1 paragraph-shaped skeleton line (not a spinner).
- `ready` & `regions.length > 0` → heading + `<RouteRegions variant="stacked" regions={...} />` paragraph form (NOT chips; see designs/figma.md AC-4).
- `ready` & `regions.length === 0` → heading + muted hint 「此路線未涵蓋任何已知行政區。」 followed by 「送出後仍會以 ST_Intersects 重新計算一次。」 (this empty hint is admin-only — the public page hides the section for the same data; see the previous Requirement).
- `error` → heading + red-tinted alert with title 「✕ 無法預覽區域」 and body that explicitly tells the user the submit button still works.

The submit button SHALL remain enabled in all four variants — `previewRegions` failures never block submission because `createRoute`'s in-transaction `detectRegions` call is the canonical source of truth.

#### Scenario: Loading state renders skeleton with the loading data-state

- **WHEN** `regionsState.kind === 'loading'`
- **THEN** the DOM contains `[data-testid="upload-regions-state"][data-state="loading"]`
- **AND** the body contains 「正在判斷區域…」 and exactly 1 paragraph-shaped skeleton element
- **AND** the submit button is NOT disabled

> See: ../../designs/figma.md

#### Scenario: Ready state with regions renders the paragraph form

- **WHEN** `regionsState.kind === 'ready'` AND `regions.length > 0`
- **THEN** the DOM contains `[data-state="ready"]`
- **AND** the body renders `<RouteRegions variant="stacked" regions={...} />` (per-county paragraph, NOT chip / badge / pill UI)
- **AND** the submit button is NOT disabled

> See: ../../designs/figma.md

#### Scenario: Ready-empty state renders the admin-only empty hint

- **WHEN** `regionsState.kind === 'ready'` AND `regions.length === 0`
- **THEN** the DOM contains `[data-state="ready-empty"]`
- **AND** the body renders the muted hint 「此路線未涵蓋任何已知行政區。」 and 「送出後仍會以 ST_Intersects 重新計算一次。」
- **AND** the submit button is NOT disabled

> See: ../../designs/figma.md

#### Scenario: Error state renders alert and keeps submit enabled

- **WHEN** `regionsState.kind === 'error'`
- **THEN** the DOM contains `[data-state="error"]`
- **AND** the body renders a red-tinted alert containing 「✕ 無法預覽區域」 and a body string explaining that the submit button stays enabled
- **AND** the submit button is NOT disabled

> See: ../../designs/figma.md

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

#### Scenario: Township parent_code is resolved from county COUNTYNAME

- **WHEN** the fetched township feature carries `properties.COUNTYNAME` but no `properties.COUNTYSN` and no `properties.COUNTYCODE` (this is the actual g0v shape)
- **AND** the same `COUNTYNAME` matches a county feature whose code is `properties.COUNTYSN = "10021000"`
- **THEN** the script SHALL inject `properties.COUNTYSN = "10021000"` onto the township feature before calling `normalizeAdminUnits`
- **AND** the written seed township SHALL carry `parent_code = "county:10021000"` (level-prefixed; see "Codes are prefixed with level" scenario below)

#### Scenario: Codes are prefixed with level to avoid g0v SN collisions

- **WHEN** the script writes the seed FeatureCollection
- **THEN** every county feature SHALL have `properties.code = "county:<COUNTYSN>"` AND `properties.parent_code = null`
- **AND** every township feature SHALL have `properties.code = "township:<TOWNSN>"` AND `properties.parent_code = "county:<COUNTYSN of its parent>"`
- **AND** no two features in the written seed SHALL share the same `code` (the prefix disambiguates the otherwise-overlapping g0v COUNTYSN / TOWNSN spaces)

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

