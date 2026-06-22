## ADDED Requirements

### Requirement: parseGpx computes elevation_profile from trackpoints

The system SHALL extend `parseGpx(input: Uint8Array | string): GpxMetadata` in `lib/gpx/parse.ts` so that the returned `GpxMetadata` includes `elevationProfile: Array<[number, number]>` — a series of `[cumulativeDistanceMetres, elevationMetres]` pairs derived from the trackpoints. The first pair's distance SHALL be `0`. Distance SHALL be monotonically non-decreasing across pairs. Trackpoints without `<ele>` SHALL be skipped (distance still accumulates so the series stays gap-free in the distance axis). The series SHALL be simplified by a generic Ramer-Douglas-Peucker algorithm (factored as `ramerDouglasPeucker<T>(points, distanceFn, tol)` in `lib/gpx/simplify.ts`, also reused by the existing `simplifyLineString` for lng/lat) with initial tolerance `0.5m`; if the simplified output still exceeds 300 points the tolerance SHALL be increased iteratively until the count is `≤ 300`. Numeric values SHALL be rounded — distance to integer metres, elevation to one decimal place. When fewer than two valid `(distance, ele)` pairs exist the function SHALL return `elevationProfile: []` (no chart will render).

#### Scenario: GPX with continuous elevation data
- **WHEN** `parseGpx(buffer)` is called with a GPX file whose trackpoints all carry `<ele>` values
- **THEN** `GpxMetadata.elevationProfile` is a non-empty array
- **AND** `elevationProfile.length` is in the range `[2, 300]`
- **AND** `elevationProfile[0][0] === 0`
- **AND** for every adjacent pair `(a, b)` in the array, `b[0] >= a[0]` (distance monotonic)

> See: ../../designs/figma.md

#### Scenario: GPX without any `<ele>` tags
- **WHEN** `parseGpx(buffer)` is called with a GPX file whose trackpoints do not carry `<ele>` values
- **THEN** `GpxMetadata.elevationProfile` is exactly `[]`
- **AND** `GpxMetadata.elevationGainM` is `0`

#### Scenario: GPX with sparse `<ele>` tags
- **WHEN** `parseGpx(buffer)` is called with a GPX file where only some trackpoints carry `<ele>`
- **THEN** `elevationProfile` contains entries only at trackpoints with `<ele>`
- **AND** the cumulative distance at each entry reflects the running distance over ALL trackpoints (including those without `<ele>`)
- **AND** `elevationProfile.length >= 2`

### Requirement: routes.elevation_profile jsonb column stores the per-route profile

The system SHALL add an `elevation_profile jsonb NOT NULL DEFAULT '[]'::jsonb` column to the `routes` table via migration `0005_add_elevation_profile.sql`. The column's stored value SHALL be an array of `[number, number]` pairs matching the shape returned by `parseGpx`. Existing rows created before this migration SHALL retain the column's default `[]` value (no backfill in this change; backfill is out of scope per design.md §10.1). The Drizzle schema (`lib/db/schema.ts`) SHALL expose this column as `routes.elevationProfile` of jsonb type. The `createRoute` Server Action SHALL include `elevation_profile` in its routes INSERT statement, sourcing the value exclusively from the server-side `parseGpx` result (never from client-supplied input).

#### Scenario: Migration adds column with default empty array
- **WHEN** `pnpm db:migrate` runs `0005_add_elevation_profile.sql`
- **THEN** the `routes` table contains an `elevation_profile` column of type `jsonb`
- **AND** the column is `NOT NULL` with default `'[]'::jsonb`
- **AND** any pre-existing rows have `elevation_profile = '[]'::jsonb`

> See: ../../designs/figma.md

#### Scenario: createRoute persists the parsed profile
- **WHEN** `createRoute(formData)` succeeds with a GPX containing `<ele>` trackpoints
- **THEN** the inserted routes row's `elevation_profile` column equals the `parseGpx(buffer).elevationProfile` value byte-for-byte
- **AND** the value is NOT derived from any client-supplied FormData key

#### Scenario: createRoute persists empty profile for elevation-less GPX
- **WHEN** `createRoute(formData)` succeeds with a GPX whose trackpoints lack `<ele>`
- **THEN** the inserted routes row's `elevation_profile` column equals `'[]'::jsonb`

### Requirement: ElevationProfile renders SVG or empty hint

The system SHALL provide a Server Component `<ElevationProfile profile={Array<[number, number]>} />` under `features/route-detail/ElevationProfile.tsx`. Pure rendering logic (profile → SVG `d` path, viewBox calculation, axis labels) SHALL be factored into `features/route-detail/elevationProfileView.ts` so it can be unit-tested without a React testing library (matching the project's existing no-RTL convention). When the input array is non-empty the component SHALL render an `<svg data-testid="elevation-profile">` element containing a `<path>` for the curve, plus monospace x-axis (`{km}`) and y-axis (`{m}`) labels, styled with V2 Trail Vintage tokens (rust-coloured curve, forest-tinted axis text). When the input array is empty the component SHALL render `<p data-testid="elevation-empty">此路線無海拔資料</p>` and SHALL NOT render any `<svg>` element. The component SHALL NOT require any client-side JavaScript (no hover tooltip, no animation in this change — that is out of scope per design.md §10.6).

#### Scenario: Renders SVG for non-empty profile
- **WHEN** `<ElevationProfile profile={[[0, 12], [105, 14], [218, 18], ..., [15028, 12]]} />` is rendered
- **THEN** the output contains exactly one `<svg data-testid="elevation-profile" viewBox="...">` element
- **AND** the SVG contains a `<path d="M0,Y L X,Y ...">` matching the profile
- **AND** the SVG contains text nodes for x-axis labels (kilometres) and y-axis labels (metres) in monospace
- **AND** the output does NOT contain `data-testid="elevation-empty"`

> See: ../../designs/figma.md

#### Scenario: Renders empty hint for empty profile
- **WHEN** `<ElevationProfile profile={[]} />` is rendered
- **THEN** the output is exactly `<p data-testid="elevation-empty">此路線無海拔資料</p>`
- **AND** the output does NOT contain any `<svg>` element

#### Scenario: Pure view logic is unit-testable
- **WHEN** `profileToSvg([[0, 10], [100, 20]])` is called from `elevationProfileView.ts`
- **THEN** the function returns an object including `d` (an SVG path string starting with `M0,`), `viewBox` (a string), `xLabels` (array of {value, x}), and `yLabels` (array of {value, y})
- **AND** when called with `[]` the function returns `{ kind: 'empty' }`

### Requirement: Public /routes/[slug] embeds the elevation profile section

The system SHALL upgrade `app/(public)/routes/[slug]/page.tsx` from the existing placeholder ("Coming soon · 海拔曲線") to a real Server-rendered page that fetches the route by slug (anon RLS: only published rows visible) and renders `<ElevationProfile profile={route.elevationProfile} />` inside a labelled section titled 「海拔曲線」 of the detail page layout. The section SHALL render even when the profile is empty (so the empty-state hint is visible). The page SHALL keep its other detail-page responsibilities (hero, stat chips, map placeholder, description, GPX download button) per design.md §4.2.

#### Scenario: Published route detail page shows elevation section
- **WHEN** a visitor opens `/routes/{published-slug}` for a route whose `elevation_profile` is non-empty
- **THEN** the page response status is 200
- **AND** the page contains a section labelled 「海拔曲線」
- **AND** the section contains `<svg data-testid="elevation-profile">` with the rendered curve

> See: ../../designs/figma.md

#### Scenario: Detail page shows empty hint for elevation-less route
- **WHEN** a visitor opens `/routes/{published-slug}` for a route whose `elevation_profile = '[]'::jsonb`
- **THEN** the page contains a section labelled 「海拔曲線」
- **AND** the section contains `<p data-testid="elevation-empty">此路線無海拔資料</p>`
- **AND** the section does NOT contain any `<svg>` element

#### Scenario: Unknown slug returns 404
- **WHEN** a visitor opens `/routes/{nonexistent-slug}`
- **THEN** the page invokes Next.js `notFound()` and returns 404
