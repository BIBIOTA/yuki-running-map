## ADDED Requirements

### Requirement: Supabase project and gpx Storage bucket are provisioned
The system SHALL operate against a Supabase project that has `postgis` extension enabled and a public `gpx` Storage bucket created.

#### Scenario: PostGIS extension is enabled
- **WHEN** an operator opens Supabase Dashboard → Database → Extensions
- **THEN** `postgis` extension is listed as enabled

#### Scenario: gpx bucket exists and is public
- **WHEN** an operator opens Supabase Dashboard → Storage → Buckets
- **THEN** a bucket named `gpx` exists
- **AND** its public flag is true

#### Scenario: Supabase URL and keys are recorded in .env.local
- **WHEN** Yuki sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- **THEN** `pnpm dev` boots without missing-env warnings
- **AND** a server-side fetch against the Supabase REST endpoint with the anon key returns HTTP 200

### Requirement: Supabase Auth GitHub OAuth provider is configured
The system SHALL authenticate admin via Supabase Auth's GitHub OAuth provider, with the provider configured in Supabase Dashboard and the corresponding GitHub OAuth App pointing back to Supabase's callback URL.

#### Scenario: GitHub provider is enabled in Supabase
- **WHEN** an operator opens Supabase Dashboard → Authentication → Providers
- **THEN** the GitHub provider row shows enabled = true
- **AND** the client_id and client_secret fields are populated

#### Scenario: GitHub OAuth App callback URL matches Supabase
- **WHEN** an operator opens the GitHub OAuth App settings
- **THEN** the Authorization callback URL equals `https://<supabase-ref>.supabase.co/auth/v1/callback`

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

### Requirement: Drizzle schema defines the routes table
The system SHALL include `lib/db/schema.ts` defining the `routes` table whose columns match `docs/data-model.md` §`routes` table, with `bbox` and `start_point` typed as PostGIS geometry via `customType` helpers in `lib/db/postgis.ts`.

#### Scenario: Schema file compiles with TypeScript strict
- **WHEN** `pnpm typecheck` runs
- **THEN** the command exits 0
- **AND** the `routes` table export is reachable from any module under `lib/db/`

#### Scenario: PostGIS columns use customType helpers
- **WHEN** a reader opens `lib/db/schema.ts`
- **THEN** `bbox` column is declared via the helper that maps to `geometry(Polygon, 4326)`
- **AND** `start_point` column is declared via the helper that maps to `geometry(Point, 4326)`

> See: ../../diagrams/02-er-routes-schema.puml

### Requirement: Drizzle migration creates routes table with PostGIS indexes
The system SHALL include a Drizzle migration that, when applied to a clean Supabase Postgres, creates the `routes` table with four indexes: `routes_bbox_gist` (GIST on `bbox`), `routes_start_point_gist` (GIST on `start_point`), `routes_recorded_at_desc` (btree on `recorded_at DESC`), and `routes_tags_gin` (GIN on `tags`).

#### Scenario: Migration applies cleanly
- **WHEN** an operator runs `pnpm db:migrate` against a clean Supabase Postgres
- **THEN** the `routes` table exists with all columns from the Drizzle schema
- **AND** all four indexes (`routes_bbox_gist`, `routes_start_point_gist`, `routes_recorded_at_desc`, `routes_tags_gin`) are listed in `pg_indexes`

#### Scenario: Migration files are committed
- **WHEN** a reviewer inspects the repository
- **THEN** the migration SQL files live under `lib/db/migrations/` and are tracked by git

> See: ../../diagrams/02-er-routes-schema.puml

### Requirement: RLS policies enforce admin and public access
The system SHALL enable Row Level Security on the `routes` table with two policies (`anon_read_published`, `admin_full_access`), SHALL apply four `storage.objects` policies on the `gpx` bucket (`gpx_public_select_published`, `gpx_admin_write`, `gpx_admin_modify`, `gpx_admin_delete`), and SHALL provision both `gpx` and `tiles` Storage buckets as public via the same migration. The admin identity is determined by matching `auth.jwt()->'user_metadata'->>'user_name'` against `public.app_admin_github_username()`, an IMMUTABLE SQL function created by the migration whose body returns the configured admin GitHub username as a text literal. Changing the admin requires a follow-up `CREATE OR REPLACE FUNCTION` migration.

#### Scenario: routes table has RLS enabled with two policies
- **WHEN** an operator opens Supabase Dashboard → Database → Tables → routes
- **THEN** Row Level Security shows enabled = true
- **AND** Policies tab lists `anon_read_published` (FOR SELECT, USING `published = true`) and `admin_full_access` (FOR ALL, USING the admin-username match expression)

#### Scenario: gpx bucket has four storage policies
- **WHEN** an operator queries `pg_policies` for `tablename = 'objects'` and `policyname LIKE 'gpx%'`
- **THEN** the result includes `gpx_public_select_published` (FOR SELECT with the EXISTS-published-row condition), `gpx_admin_write` (FOR INSERT), `gpx_admin_modify` (FOR UPDATE), and `gpx_admin_delete` (FOR DELETE)

#### Scenario: Anonymous SELECT returns zero on empty table
- **WHEN** the routes table is empty and an anonymous client issues `SELECT count(*) FROM routes`
- **THEN** the result is 0

#### Scenario: Admin identity function returns the configured GitHub username
- **WHEN** a reviewer issues `SELECT public.app_admin_github_username()` after migration
- **THEN** the result equals the `ADMIN_GITHUB_USERNAME` env value supplied to the operator who authored the migration
- **AND** the function is declared `LANGUAGE sql IMMUTABLE` so the planner can inline it into the policy expression
- **AND** no client code issues `SET LOCAL` or relies on a cluster-level GUC for admin identity

#### Scenario: gpx and tiles buckets are provisioned by the migration
- **WHEN** a reviewer queries `SELECT id, public FROM storage.buckets WHERE id IN ('gpx', 'tiles')`
- **THEN** both rows exist with `public = true`
- **AND** rerunning the migration is idempotent (ON CONFLICT update keeps the buckets public)

> See: ../../diagrams/02-er-routes-schema.puml

### Requirement: Supabase client factories are exported from lib/supabase
The system SHALL export three Supabase client factories from `lib/supabase/`: `createBrowserClient` in `browser.ts` for client components, `createServerClient` in `server.ts` for server components and server actions (wrapping `@supabase/ssr` with `next/headers` cookie integration), and `createMiddlewareClient` in `middleware.ts` for edge middleware cookie management. The admin identity is established by the `public.app_admin_github_username()` SQL function created during migration (see the RLS Requirement), not by per-request `SET LOCAL` or any cluster-level GUC, so the factories carry no admin-identity setup responsibility.

#### Scenario: createBrowserClient is callable from "use client" code
- **WHEN** a Client Component imports `createBrowserClient` from `lib/supabase/browser` and calls it
- **THEN** it returns a Supabase client object exposing `auth.signInWithOAuth`, `auth.signOut`, and `from`

#### Scenario: createServerClient wraps @supabase/ssr with next/headers cookies
- **WHEN** `createServerClient` is invoked inside a Server Component or Server Action
- **THEN** it delegates to `@supabase/ssr`'s `createServerClient` with `next/headers` cookies bound for read and write
- **AND** the returned client surfaces `auth.getUser`, `auth.signOut`, and `from`

#### Scenario: createMiddlewareClient round-trips cookies
- **WHEN** `createMiddlewareClient({ req, res })` is invoked inside middleware
- **THEN** subsequent calls to `supabase.auth.getUser()` use cookies from `req` and any session refresh is written back to `res`

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

### Requirement: middleware.ts guards admin routes
The system SHALL include a root `middleware.ts` whose matcher equals `['/admin/:path*']` and which: bypasses the guard for `/admin/login`, redirects unauthenticated visitors of other `/admin/*` paths to `/admin/login`, and on mismatched `ADMIN_GITHUB_USERNAME` calls `supabase.auth.signOut()` then redirects to `/?auth_error=not_admin`. The system SHALL fail closed: when `ADMIN_GITHUB_USERNAME` is unset, no user matches admin.

#### Scenario: /admin/login bypasses the guard
- **WHEN** any client sends GET `/admin/login`
- **THEN** middleware does not call `auth.getUser()`
- **AND** responds with `NextResponse.next()`

#### Scenario: Unauthenticated request to /admin/upload is redirected
- **WHEN** a client without a Supabase session cookie sends GET `/admin/upload`
- **THEN** the response is 302 with `Location: /admin/login`

#### Scenario: Logged-in admin reaches /admin/upload
- **WHEN** a client whose session has `user_metadata.user_name = ADMIN_GITHUB_USERNAME` sends GET `/admin/upload`
- **THEN** middleware passes through and the protected page renders

#### Scenario: Non-admin user is signed out and redirected with flash
- **WHEN** a client whose session has `user_metadata.user_name != ADMIN_GITHUB_USERNAME` sends GET `/admin/upload`
- **THEN** middleware calls `supabase.auth.signOut()`
- **AND** responds 302 with `Location: /?auth_error=not_admin`

#### Scenario: Missing ADMIN_GITHUB_USERNAME blocks everyone
- **WHEN** `ADMIN_GITHUB_USERNAME` env var is unset and any authenticated client sends GET `/admin/upload`
- **THEN** middleware treats the user as non-admin and follows the sign-out + redirect path

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml
