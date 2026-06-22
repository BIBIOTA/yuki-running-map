## MODIFIED Requirements

### Requirement: /admin/routes/[id] renders the metadata edit form

The system SHALL serve `/admin/routes/[id]` to authenticated admin as a Server-rendered Node-runtime page that selects the route by id (admin RLS), prefetches existing tags via `listExistingTags(db)`, fetches the route's detected administrative regions via leftJoin on `route_admin_units` × `admin_units`, and renders `<EditPageClient initial={route} existingTags={...} routeRegions={...} />`. If the id does not match any row the page SHALL call `notFound()` and return 404. The edit form SHALL expose ONLY admin-controlled metadata fields (title / slug / description / tags / published toggle) and SHALL NOT render manually-input difficulty / duration / region fields (these are removed by `feat-gpx-driven-route-metadata`). The edit form SHALL render the detected regions as a read-only `<RouteRegions regions={...} />` paragraph section under the metadata fields. GPX-derived fields (`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `elevation_profile` / `recorded_at` / `id` / `created_at`) SHALL appear in a separate READ-ONLY card on the page.

#### Scenario: Admin opens edit page for existing route
- **WHEN** an authenticated admin sends GET `/admin/routes/{existing-id}`
- **THEN** the response status is 200
- **AND** the page renders breadcrumb 「路線管理 / 編輯」 followed by hero 「編輯路線 · {title}」
- **AND** the left column renders editable fields title / slug / description / tags / published toggle, prefilled with the route's current values
- **AND** the left column also renders a read-only `<RouteRegions regions={...} />` section showing the detected county / township text paragraphs (or hides the section when `regions` is empty)
- **AND** the left column does NOT contain any `<input id="difficulty">`, `<select id="difficulty">`, `<input id="duration_s">`, or `<input id="region">` element
- **AND** the right column renders a READ-ONLY card titled 「GPX 衍生（鎖定）」 containing 距離 / 累積爬升 / 軌跡點數 / 紀錄時間 / gpx_path / elevation_profile point count

#### Scenario: Edit page for unknown id returns 404
- **WHEN** an authenticated admin sends GET `/admin/routes/{nonexistent-id}`
- **THEN** the response status is 404
- **AND** the page invokes Next.js `notFound()`

> See: ../../designs/figma.md

### Requirement: /admin/routes lists all routes including drafts

The system SHALL serve `/admin/routes` to authenticated admin as a Server-rendered Node-runtime page that selects all rows from `routes` (admin RLS sees both published and draft rows) ordered by `created_at DESC` and renders `<RouteList routes={...} />`. The query SHALL leftJoin `route_admin_units` × `admin_units` so each row carries its detected `regions: Region[]`. The list SHALL include per-row navigation to `/admin/routes/{id}` for editing and a `<DeleteRouteButton>` for deletion. The 區域 column SHALL render a single-line truncated `<RouteRegions regions={...} variant="inline" />` paragraph (`{縣市} {鄉鎮…} / {縣市} {鄉鎮…}` with CSS `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`); 0 regions SHALL display 「—」. When the table is empty the page SHALL render an empty-state card with a CTA to `/admin/upload`.

#### Scenario: Admin sees populated route list
- **WHEN** an authenticated admin sends GET `/admin/routes` and the `routes` table has at least one row
- **THEN** the response status is 200
- **AND** the page renders a Table containing one row per route with columns 標題 / Slug / 區域 / 狀態 / 紀錄日 / 操作
- **AND** rows with `published = false` show a 草稿 badge in the 標題 cell and a `● 草稿` badge in the 狀態 cell
- **AND** rows with `published = true` show a `● 已發佈` badge in the 狀態 cell rendered in the brand colour
- **AND** the 區域 cell renders the row's `regions` via `<RouteRegions variant="inline" />` truncated to a single line, or 「—」 when 0 regions
- **AND** the 操作 cell exposes an 編輯 link to `/admin/routes/{id}` and a 刪除 control wired to `<DeleteRouteButton>`

#### Scenario: Admin sees empty state when no routes exist
- **WHEN** an authenticated admin sends GET `/admin/routes` and the `routes` table is empty
- **THEN** the response status is 200
- **AND** the page renders an empty-state card containing the text 「尚無路線」 and the helper text 「請至 /admin/upload 新增第一條路線。」
- **AND** the card contains a `+ 新增路線` CTA whose href is `/admin/upload`

> See: ../../designs/figma.md

### Requirement: createRoute Server Action persists the new route with rollback

The system SHALL expose a Node-runtime Server Action `createRoute(formData)` under `features/admin-routes/actions/createRoute.ts`. The Action SHALL validate metadata via `validateRouteMetadata`, server-side parse the GPX via `parseGpx(buffer)`, upload the buffer to `gpx/{yyyy}/{uuid}.gpx` in the `gpx` Storage bucket, and execute the remaining DB work inside a single explicit `db.transaction` that runs (1) INSERT into `routes` (including `elevation_profile` from the parse result), (2) `detectRegions(tx, geojson)` spatial query against `admin_units` via `ST_Intersects`, and (3) INSERT of the resulting `admin_unit_id` rows into `route_admin_units`. After the transaction commits the Action SHALL call `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')` before returning. On any failure between Storage upload and transaction commit the Action SHALL invoke `supabase.storage.from('gpx').remove([path])` to rollback. The Action SHALL return a discriminated union `{ ok: true, id, slug } | { ok: false, fieldErrors }` and SHALL NOT throw across the client boundary; client metadata SHALL NOT be trusted for GPX-derived columns (all GPX-derived values come from the server-side `parseGpx` result; detected regions come from the server-side spatial query — never from the client).

#### Scenario: Happy path creates row, join rows, and Storage object
- **WHEN** an authenticated admin calls `createRoute(formData)` with a valid GPX file and complete metadata (title / slug / description / tags / published)
- **THEN** the GPX buffer is uploaded to `gpx/{yyyy}/{uuid}.gpx`
- **AND** within a single `db.transaction`, a new row is INSERTed into `routes` with `gpx_path` matching the upload path and `distance_m` / `elevation_gain_m` / `elevation_profile` / `bbox` / `start_point` / `geojson` / `recorded_at` all derived from the server-side `parseGpx(buffer)` call
- **AND** the same transaction inserts one row into `route_admin_units` per `admin_unit_id` returned by `detectRegions(tx, geojson)` via `ST_Intersects(admin_units.geom, ST_GeomFromGeoJSON(...))`
- **AND** `revalidatePath('/routes')`, `revalidatePath('/routes/' + slug)`, and `revalidatePath('/admin/routes')` are called
- **AND** the Action returns `{ ok: true, id, slug }`

#### Scenario: GPX with zero region intersections still succeeds with empty join
- **WHEN** the GPX line does not intersect any `admin_units.geom` (e.g., offshore route)
- **THEN** the transaction inserts the routes row and inserts ZERO rows into `route_admin_units`
- **AND** the Action returns `{ ok: true, id, slug }`
- **AND** the route is not blocked from publishing

#### Scenario: Metadata validation failure rejects without writes
- **WHEN** `createRoute(formData)` receives input that fails `validateRouteMetadata`
- **THEN** no Storage upload occurs
- **AND** no INSERT occurs
- **AND** the Action returns `{ ok: false, fieldErrors }` whose keys identify the failed fields

#### Scenario: Server-side parseGpx failure rejects without Storage write
- **WHEN** `createRoute(formData)` receives a file that throws from `parseGpx` (no trackpoints, invalid XML)
- **THEN** no Storage upload occurs
- **AND** the Action returns `{ ok: false, fieldErrors: { gpxFile: 'GPX 解析失敗（無有效軌跡點？）' } }`

#### Scenario: Storage upload failure surfaces _form error without DB write
- **WHEN** `createRoute(formData)` receives a valid file and metadata but `storage.upload` throws
- **THEN** no INSERT occurs
- **AND** the Action returns `{ ok: false, fieldErrors: { _form: 'Storage 上傳失敗，請重試' } }`

#### Scenario: Slug UNIQUE conflict rolls back Storage upload and transaction
- **WHEN** `createRoute(formData)` succeeds at Storage upload but the routes INSERT throws a `postgres` error with code `23505` matching constraint `routes_slug_unique`
- **THEN** the entire `db.transaction` rolls back (no routes row, no `route_admin_units` rows)
- **AND** `storage.from('gpx').remove([path])` is invoked to delete the uploaded object
- **AND** the Action returns `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`

#### Scenario: Spatial query failure rolls back routes INSERT and Storage upload
- **WHEN** the routes INSERT succeeds inside the transaction but `detectRegions(tx, geojson)` throws (e.g., malformed geometry rejected by PostGIS)
- **THEN** the transaction rolls back (no routes row, no join rows)
- **AND** `storage.from('gpx').remove([path])` is invoked
- **AND** the Action returns `{ ok: false, fieldErrors: { _form: '行政區判斷失敗：{message}' } }`
- **AND** `console.error(e)` is called

#### Scenario: Other INSERT failure rolls back Storage and reports _form
- **WHEN** `createRoute(formData)` succeeds at Storage upload but any other transaction error occurs
- **THEN** the transaction rolls back
- **AND** `storage.from('gpx').remove([path])` is invoked
- **AND** the Action returns `{ ok: false, fieldErrors: { _form: '寫入失敗：...' } }`
- **AND** `console.error(e)` is called

> See: ../../designs/figma.md

### Requirement: updateRoute Server Action mutates metadata only

The system SHALL expose a Node-runtime Server Action `updateRoute({ id, ...meta })` under `features/admin-routes/actions/updateRoute.ts`. The Action SHALL validate metadata via `validateRouteMetadata`, fetch the current slug from the database (`SELECT slug FROM routes WHERE id=$1`), UPDATE the row's metadata columns with the validated input plus `updated_at = now()`, and call `revalidatePath` for `/routes`, the old slug path (if changed), the new slug path, and `/admin/routes` before returning. The accepted metadata keys SHALL be exactly `title` / `slug` / `description` / `tags` / `published`. The Action SHALL strip GPX-derived keys (`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `elevation_profile` / `recorded_at` / `id` / `created_at`) AND legacy keys (`difficulty` / `duration_s` / `region`) from the input before UPDATE. The Action SHALL NOT re-run `detectRegions` (the join table is established at create time only; changing the underlying GPX requires a delete-and-recreate flow). Failures SHALL return a discriminated union `{ ok: true } | { ok: false, fieldErrors }`.

#### Scenario: Happy path updates metadata and revalidates both slug paths
- **WHEN** `updateRoute({ id, title, slug, description, tags, published })` is called with a slug different from the stored value
- **THEN** the Action runs `SELECT slug FROM routes WHERE id=$1` to obtain `oldSlug`
- **AND** the Action runs UPDATE with the validated metadata (GPX-derived + legacy keys stripped) plus `updated_at = now()`
- **AND** the Action does NOT touch `route_admin_units`
- **AND** the Action calls `revalidatePath('/routes')`, `revalidatePath('/routes/' + oldSlug)`, `revalidatePath('/routes/' + newSlug)`, and `revalidatePath('/admin/routes')`
- **AND** the Action returns `{ ok: true }`

#### Scenario: Legacy difficulty / duration / region keys are silently stripped
- **WHEN** a client submits a form whose payload includes `difficulty`, `duration_s`, or `region`
- **THEN** the Action removes those keys from the input before UPDATE
- **AND** the UPDATE statement targets ONLY the accepted metadata columns

#### Scenario: GPX-derived keys sent by client are silently stripped
- **WHEN** the client submits a form whose payload includes `gpx_path`, `elevation_profile`, or any other GPX-derived column
- **THEN** the Action removes those keys from the input before UPDATE
- **AND** the corresponding database columns retain their existing values

#### Scenario: Slug UNIQUE conflict surfaces fieldErrors.slug
- **WHEN** `updateRoute({ id, ...meta })` triggers a `postgres` 23505 error on `routes_slug_unique`
- **THEN** the Action returns `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`

> See: ../../designs/figma.md

### Requirement: validateRouteMetadata enforces field-level rules

The system SHALL expose `validateRouteMetadata(input: unknown)` from `lib/admin-routes/validation.ts`. The function SHALL return a discriminated union `{ ok: true, value: RouteMetadataInput } | { ok: false, fieldErrors: Record<string, string> }`. The validator SHALL enforce: `title` required and trimmed length 1–200; `slug` required and matching `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` and length ≤ 80; `description` optional and length ≤ 5000; `tags` an array of trimmed, deduplicated, non-empty strings each of length ≤ 30, with at most 20 elements; `published` required boolean. The validator SHALL NOT accept `difficulty`, `duration_s`, or `region` keys (removed by `feat-gpx-driven-route-metadata`); unknown keys SHALL be silently ignored, not rejected, to preserve backward compatibility with any older clients still sending them.

#### Scenario: Valid input returns ok
- **WHEN** `validateRouteMetadata({ title, slug, tags, published, ... })` is called with input satisfying every rule
- **THEN** the function returns `{ ok: true, value }` where `value` is the normalised input (title trimmed, tags trimmed/deduped, etc.)
- **AND** `value` does NOT contain `difficulty`, `duration_s`, or `region` fields

#### Scenario: Invalid slug returns fieldErrors.slug
- **WHEN** `validateRouteMetadata({ slug: 'Foo Bar', ... })` is called (capital letter + space fails the regex)
- **THEN** the function returns `{ ok: false, fieldErrors }` whose `slug` entry is a human-readable error message

#### Scenario: Tag deduplication and trimming
- **WHEN** `validateRouteMetadata({ tags: ['河濱', ' 河濱 ', '', 'LSD'], ... })` is called
- **THEN** the function returns `{ ok: true, value: { tags: ['河濱', 'LSD'] } }`

#### Scenario: Legacy fields are silently ignored
- **WHEN** `validateRouteMetadata({ title, slug, tags, published, difficulty: 'easy', duration_s: 1800, region: '台北' })` is called (older client payload)
- **THEN** the function returns `{ ok: true, value }`
- **AND** `value` does NOT contain `difficulty`, `duration_s`, or `region` keys
- **AND** no `fieldErrors` entry references these legacy field names

> See: ../../designs/figma.md

### Requirement: E2E coverage for admin CRUD flows

The system SHALL include Playwright specs covering the admin upload, edit, and delete flows: `e2e/admin-routes-upload.spec.ts` exercises the upload-and-publish flow, `e2e/admin-routes-edit.spec.ts` exercises metadata edit, and `e2e/admin-routes-delete.spec.ts` exercises confirm-and-delete. Each spec SHALL use the Wave-C admin-OAuth fixture and SHALL truncate the `routes` table and `storage.objects` (bucket `gpx`) in `beforeEach`. No spec SHALL fill any 難度 or 預計時長 form input (the fields are removed). The upload and edit specs SHALL seed `admin_units` fixtures via `seedAdminUnits(...)` and assert that the form renders a non-empty `<RouteRegions>` section after upload completes. The upload spec SHALL further assert that the published `/routes/{slug}` page renders either `data-testid="elevation-profile"` (when the GPX includes `<ele>`) or `data-testid="elevation-empty"` (when it does not).

#### Scenario: admin-routes-upload e2e exercises upload + region detection + elevation render
- **WHEN** the `e2e/admin-routes-upload.spec.ts` spec runs under `pnpm test:e2e`
- **THEN** `beforeEach` truncates `routes` / `storage.objects` and seeds the mini `admin_units` fixture covering the GPX bbox
- **AND** the admin logs in via the OAuth fixture, navigates to `/admin/upload`, drops `e2e/fixtures/taipei-loop.gpx`
- **AND** the page renders the map preview and metadata card without any 難度 or 預計時長 input
- **AND** after submitting the form, the spec lands on `/admin/routes` with the new row visible and a sonner toast 「已新增」 present
- **AND** the admin route list 區域 column displays a non-empty `<RouteRegions>` truncated paragraph for the new row
- **AND** navigating to the published `/routes/{slug}` page renders either `data-testid="elevation-profile"` or `data-testid="elevation-empty"` and a non-empty `<RouteRegions>` section

#### Scenario: admin-routes-edit e2e edits and persists metadata
- **WHEN** the `e2e/admin-routes-edit.spec.ts` spec runs with one seeded route + seeded `admin_units` fixture
- **THEN** the admin navigates from `/admin/routes` to `/admin/routes/{id}`, sees the read-only `<RouteRegions>` section, modifies title and tags, and saves
- **AND** the spec observes the sonner toast 「已儲存」 and the new values prefilled in the form
- **AND** the spec verifies the form contains NO 難度 / 預計時長 / 地區 inputs
- **AND** reloading the page shows the new values persisted from the database

#### Scenario: admin-routes-delete e2e confirms and verifies deletion + CASCADE
- **WHEN** the `e2e/admin-routes-delete.spec.ts` spec runs with one seeded route plus existing `route_admin_units` rows
- **THEN** the admin clicks 「刪除」, confirms in the `AlertDialog`, and observes the row disappear plus a sonner toast 「已刪除」
- **AND** a follow-up admin query confirms the row is no longer in the `routes` table
- **AND** the corresponding rows in `route_admin_units` are also gone (ON DELETE CASCADE)
- **AND** the corresponding Storage object under `gpx/` is no longer present

> See: ../../designs/figma.md
