## ADDED Requirements

### Requirement: Upload preview renders ElevationProfile below the map preview

The system SHALL render `<ElevationProfile profile={parsed.elevationProfile} />` from `features/route-detail/ElevationProfile.tsx` inside `<UploadPageClient>` once the `Phase` machine reaches `kind === 'loaded'`. The component SHALL appear inside a `<section aria-labelledby="upload-elevation-heading">` directly below `<RouteMapPreview>` and SHALL use the same card chrome (`bg-card`, `border-border`, `rounded-md`, `p-3`) as the public detail page so the upload preview matches what the route will look like after submission. No new SVG component SHALL be introduced — the existing `<ElevationProfile>` is reused as-is.

#### Scenario: Loaded phase mounts the elevation section

- **WHEN** `phase.kind === 'loaded'` in `<UploadPageClient>`
- **THEN** the DOM contains `<section aria-labelledby="upload-elevation-heading">` directly below `<RouteMapPreview>`
- **AND** the section contains `<ElevationProfile profile={...} />` from `features/route-detail/ElevationProfile.tsx` (no duplicate or alternative SVG)
- **AND** when `phase.elevationProfile.length === 0` the existing `[data-testid="elevation-empty"]` placeholder is rendered
- **AND** when `phase.elevationProfile.length > 0` the existing `[data-testid="elevation-profile"]` SVG is rendered

> See: ../../designs/figma.md

#### Scenario: Empty phase mounts neither map nor elevation section

- **WHEN** `phase.kind === 'empty'`
- **THEN** the DOM does NOT contain `<section aria-labelledby="upload-elevation-heading">`
- **AND** the DOM does NOT contain `<RouteMapPreview>`

### Requirement: Edit page renders ElevationProfile from the persisted profile column

The system SHALL render `<ElevationProfile profile={route.elevationProfile} />` inside `<EditPageClient>` directly below the read-only `<RouteMapPreview>` for the route. The component SHALL read from the persisted `routes.elevationProfile` jsonb column (already populated by `createRoute` at upload time). The chrome SHALL be identical to the upload-preview elevation section so a route author sees the same visual when editing as when uploading.

#### Scenario: Edit page mounts the elevation section beneath the map

- **WHEN** an authenticated admin opens `/admin/routes/{existing-id}` for a route with a non-empty `elevationProfile`
- **THEN** the DOM contains `<section aria-labelledby="edit-elevation-heading">` directly below `<RouteMapPreview>`
- **AND** the section contains `<ElevationProfile profile={route.elevationProfile} />` rendered via `[data-testid="elevation-profile"]`

> See: ../../designs/figma.md

#### Scenario: Edit page falls back to the empty placeholder for routes with no elevation

- **WHEN** the route's `elevationProfile.length === 0` (e.g. GPX had no `<ele>` tags)
- **THEN** the DOM contains `[data-testid="elevation-empty"]` with the text 「此路線無海拔資料」
- **AND** the rest of the form remains usable

> See: ../../designs/figma.md
