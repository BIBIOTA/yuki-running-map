## ADDED Requirements

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
