# data-and-auth-infrastructure Specification

## Purpose
TBD - created by archiving change bootstrap-yuki-running-map. Update Purpose after archive.
## Requirements
### Requirement: Map helper module loads PMTiles via MapLibre GL JS
The system SHALL expose `lib/map/createMap(container, options)` that returns a MapLibre GL map configured to load Protomaps PMTiles from `NEXT_PUBLIC_PMTILES_URL` using the map style exported from `lib/map/style.ts`.

#### Scenario: createMap renders a base map
- **WHEN** a Client Component mounts `createMap(container, { center, zoom })`
- **THEN** the container displays a rendered base map sourced from the configured PMTiles file

### Requirement: GPX helper module parses, simplifies, and extracts metadata
The system SHALL expose `lib/gpx/parseGpx(buffer)` returning `{ geojson, distanceM, elevationGainM, bbox, startPoint, recordedAt }` and `lib/gpx/simplifyLineString(coords, tolerance=0.0001)` returning a simplified coordinate array with 100–500 points whose first and last coordinates match the input.

#### Scenario: parseGpx returns the expected metadata for a fixture
- **WHEN** `parseGpx(buffer)` is called with a known fixture GPX file
- **THEN** the returned `distanceM` matches the fixture's expected total within ±5 m
- **AND** `bbox` contains the expected south-west and north-east coordinates

#### Scenario: simplifyLineString preserves endpoints
- **WHEN** `simplifyLineString(coords, 0.0001)` is called with > 1000 input coordinates
- **THEN** the output length is between 100 and 500
- **AND** `output[0]` equals `coords[0]`
- **AND** `output[output.length - 1]` equals `coords[coords.length - 1]`

#### Scenario: Unit test coverage threshold is met
- **WHEN** Vitest runs with coverage on `lib/gpx/*`
- **THEN** statement coverage is at least 80%

