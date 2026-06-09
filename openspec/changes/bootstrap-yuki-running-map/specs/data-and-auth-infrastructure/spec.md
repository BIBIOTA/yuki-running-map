## ADDED Requirements

### Requirement: Supabase project is provisioned with PostGIS and gpx Storage bucket
The system SHALL run on a Supabase project where the PostGIS extension is enabled and a `gpx` Storage bucket exists with public-read disabled.

#### Scenario: PostGIS extension is active
- **WHEN** a developer runs `select postgis_version()` against the project's database
- **THEN** a non-empty version string is returned

#### Scenario: gpx bucket exists and is admin-write only
- **WHEN** the Supabase dashboard lists Storage buckets
- **THEN** a bucket named `gpx` is present
- **AND** the bucket has public read disabled
- **AND** the provisioning steps are documented in `docs/runbooks/deploy.md`

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: GitHub OAuth provider is configured in Supabase Auth
The system SHALL configure Supabase Auth's GitHub OAuth provider with the correct client id, secret, and callback URL so the admin login flow completes end-to-end.

#### Scenario: OAuth flow returns a Supabase session
- **WHEN** an admin clicks "Sign in with GitHub" on `/admin/login`
- **THEN** the browser is redirected to GitHub's authorize page
- **AND** after consent, the callback URL returns to Supabase which issues a session cookie
- **AND** the setup steps are documented in `docs/runbooks/deploy.md`

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Drizzle schema defines the routes table with PostGIS columns and enums
The system SHALL define a Drizzle ORM schema for a `routes` table covering every column from `design.md` §4 — including `geometry(Polygon,4326)` `bbox`, `geometry(Point,4326)` `start_point`, the `difficulty` enum, the `tags text[]` array, plus timestamps and the `published` boolean.

#### Scenario: drizzle-kit generates the expected migration
- **WHEN** a developer runs `pnpm drizzle-kit generate`
- **THEN** a migration SQL file is produced that creates the `routes` table with every column from `design.md` §4
- **AND** the schema file lives at `lib/db/schema.ts`

### Requirement: Routes table carries the required indexes
The system SHALL create GIST indexes on `bbox` and `start_point`, a GIN index on `tags`, and a btree descending index on `recorded_at`.

#### Scenario: Indexes are present after migration
- **WHEN** `pnpm db:migrate` completes successfully
- **THEN** `\d routes` lists `GIST(bbox)`, `GIST(start_point)`, `GIN(tags)`, and `btree(recorded_at DESC)`
- **AND** the indexes are verified by querying `pg_indexes`

### Requirement: Row Level Security enforces admin-only writes
The system SHALL apply RLS policies so that anonymous SELECT returns only `published=true` rows and any INSERT, UPDATE, or DELETE against `routes` or `storage.objects` (bucket `gpx`) is rejected for non-admin sessions.

#### Scenario: Anonymous read is filtered to published rows
- **WHEN** an unauthenticated client queries `select * from routes`
- **THEN** only rows where `published = true` are returned

#### Scenario: Non-admin writes are rejected
- **WHEN** an authenticated client whose `auth.jwt()->user_metadata->>user_name` differs from `ADMIN_GITHUB_USERNAME` attempts INSERT/UPDATE/DELETE on `routes` or upload on `gpx`
- **THEN** the operation is rejected by RLS

#### Scenario: Admin writes succeed
- **WHEN** the admin (matching `ADMIN_GITHUB_USERNAME`) uploads a GPX object or inserts a route
- **THEN** the operation succeeds

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Supabase client helpers exist for browser, server, and middleware contexts
The system SHALL expose three Supabase client factories from `lib/supabase/` — `createBrowserClient`, `createServerClient`, and `createMiddlewareClient` — built on `@supabase/ssr` and returning correctly-typed clients for their respective runtimes.

#### Scenario: Server Component gets a cookie-aware client
- **WHEN** a Server Component calls `createServerClient()`
- **THEN** it receives a Supabase client that reads/writes the request cookies

#### Scenario: Client Component gets a singleton browser client
- **WHEN** a Client Component calls `createBrowserClient()`
- **THEN** the same client instance is returned across calls within the page

#### Scenario: middleware gets a session-refreshing client
- **WHEN** `middleware.ts` calls `createMiddlewareClient(req, res)`
- **THEN** the returned client updates session cookies on `res` as needed

### Requirement: Admin middleware guards every (admin) route
The system SHALL ship `middleware.ts` that intercepts requests to `(admin)/*`, redirects unauthenticated visitors to `/admin/login` (with a `from=` query of the original path), signs out and redirects with `error=unauthorized` any authenticated user whose GitHub username does not equal `ADMIN_GITHUB_USERNAME`, and lets authorized admins pass.

#### Scenario: Unauthenticated visitor is redirected to login
- **WHEN** an unauthenticated visitor requests `/admin/upload`
- **THEN** the response is HTTP 307 redirect to `/admin/login?from=%2Fadmin%2Fupload`

#### Scenario: Wrong GitHub user is rejected
- **WHEN** an authenticated user whose `user_metadata.user_name` is NOT `ADMIN_GITHUB_USERNAME` requests any `(admin)` route
- **THEN** the middleware calls `signOut()` and redirects to `/admin/login?error=unauthorized`

#### Scenario: Authorized admin is allowed through
- **WHEN** the admin (matching `ADMIN_GITHUB_USERNAME`) requests `(admin)/*`
- **THEN** the request is passed through to the route handler

> See: ../../diagrams/01-component-system-architecture.puml

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
