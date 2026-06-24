# admin-routes-crud Specification

## Purpose
TBD - created by archiving change feat-admin-gpx-upload. Update Purpose after archive.
## Requirements
### Requirement: /admin/upload renders the real GPX upload UI

The system SHALL serve `/admin/upload` to authenticated admin as a Server-rendered Node-runtime page that renders `<UploadPageClient />`. The page SHALL NOT prefetch tags (the 標籤 欄位 has been removed). Unauthenticated or non-admin clients SHALL continue to be intercepted by the existing admin middleware (`middleware.ts`) as defined in the `data-and-auth-infrastructure` capability.

#### Scenario: Authenticated admin sees the real upload UI without a tags prop

- **WHEN** an authenticated admin sends GET `/admin/upload`
- **THEN** the response status is 200
- **AND** the page renders the admin top nav with `上傳` link styled as active
- **AND** the body renders `<UploadPageClient />` containing `<GpxDropzone>` in its empty state
- **AND** the rendered Server Component does NOT import `listExistingTags`
- **AND** `<UploadPageClient>` does NOT receive an `existingTags` prop

> See: ../../designs/figma.md

### Requirement: /admin/routes lists all routes including drafts

The system SHALL serve `/admin/routes` to authenticated admin as a Server-rendered Node-runtime page that selects all rows from `routes` (admin RLS sees both published and draft rows) ordered by `created_at DESC` and renders `<RouteList routes={...} />`. The list SHALL include per-row navigation to `/admin/routes/{id}` for editing and a `<DeleteRouteButton>` for deletion. When the table is empty the page SHALL render an empty-state card with a CTA to `/admin/upload`.

#### Scenario: Admin sees populated route list
- **WHEN** an authenticated admin sends GET `/admin/routes` and the `routes` table has at least one row
- **THEN** the response status is 200
- **AND** the page renders a Table containing one row per route with columns 標題 / Slug / 區域 / 狀態 / 紀錄日 / 操作
- **AND** rows with `published = false` show a 草稿 badge in the 標題 cell and a `● 草稿` badge in the 狀態 cell
- **AND** rows with `published = true` show a `● 已發佈` badge in the 狀態 cell rendered in the brand colour
- **AND** the 操作 cell exposes an 編輯 link to `/admin/routes/{id}` and a 刪除 control wired to `<DeleteRouteButton>`

#### Scenario: Admin sees empty state when no routes exist
- **WHEN** an authenticated admin sends GET `/admin/routes` and the `routes` table is empty
- **THEN** the response status is 200
- **AND** the page renders an empty-state card containing the text 「尚無路線」 and the helper text 「請至 /admin/upload 新增第一條路線。」
- **AND** the card contains a `+ 新增路線` CTA whose href is `/admin/upload`

> See: ../../designs/figma.md

### Requirement: /admin/routes/[id] renders the metadata edit form

The system SHALL serve `/admin/routes/[id]` to authenticated admin as a Server-rendered Node-runtime page that selects the route by id (admin RLS) and renders `<EditPageClient initial={route} routeRegions={regions} />`. If the id does not match any row the page SHALL call `notFound()` and return 404. The edit form SHALL expose only metadata fields and SHALL NOT render GPX-derived fields. The page SHALL render `<RouteRegionsSection>` (shared chrome) and `<ElevationProfile>` (shared component) beside the form so the read-only GPX-derived surfaces match the public `/routes/[slug]` chrome.

#### Scenario: Admin opens edit page for existing route

- **WHEN** an authenticated admin sends GET `/admin/routes/{existing-id}`
- **THEN** the response status is 200
- **AND** the editable fields rendered by `<RouteMetadataForm>` are exactly `標題 / 網址代稱 (slug) / 描述 / 已發佈`
- **AND** the form does NOT render a 「標籤」 field
- **AND** the page renders `<RouteRegionsSection regions={...} />` beside the form (chrome shared with `/routes/[slug]`)
- **AND** the page renders `<ElevationProfile profile={route.elevationProfile} />` below the map preview
- **AND** the Server Component does NOT import `listExistingTags`

> See: ../../designs/figma.md

#### Scenario: Edit page for unknown id returns 404

- **WHEN** an authenticated admin sends GET `/admin/routes/{nonexistent-id}`
- **THEN** the response status is 404
- **AND** the page invokes Next.js `notFound()`

### Requirement: createRoute Server Action persists the new route with rollback

The system SHALL provide a `createRoute(formData: FormData)` Server Action that validates the metadata (title / slug / description / published only), parses the uploaded GPX server-side, uploads the buffer to Supabase Storage, and INSERTs a single `routes` row inside a Drizzle transaction. The Action SHALL NOT read or persist a `tags` field — neither the FormData parse step, nor `validateRouteMetadata`, nor the INSERT payload SHALL reference `tags`. All other behaviour from the existing requirement (storage rollback on transaction failure, slug-unique handling, region detection, revalidatePath) remains intact.

#### Scenario: Action persists exactly the canonical metadata columns

- **WHEN** a valid `createRoute(formData)` call succeeds
- **THEN** the INSERT payload contains the columns `slug / title / description / distance_m / elevation_gain_m / elevation_profile / recorded_at / gpx_path / geojson / bbox / start_point / published`
- **AND** the INSERT payload does NOT contain a `tags` column
- **AND** the action returns `{ ok: true, id, slug }`

#### Scenario: Malformed metadata is rejected without touching Storage or DB

- **WHEN** `createRoute(formData)` runs with a missing `title`
- **THEN** the action returns `{ ok: false, fieldErrors: { title: <validation message> } }`
- **AND** no Supabase Storage upload occurs
- **AND** no Drizzle INSERT occurs

> See: ../../designs/figma.md

### Requirement: updateRoute Server Action mutates metadata only

The system SHALL provide an `updateRoute(id, payload)` Server Action whose `ACCEPTED_FIELDS` allow list is exactly `["title", "slug", "description", "published"]`. The Action SHALL NOT include `"tags"` in `ACCEPTED_FIELDS` and SHALL NOT UPDATE the `routes.tags` column.

#### Scenario: Update payload containing extraneous keys ignores them

- **WHEN** `updateRoute(id, { title: "新", tags: ["x"], published: true })` runs
- **THEN** the UPDATE SET clause sets only `title` and `published`
- **AND** the SET clause does NOT mention `tags`

> See: ../../designs/figma.md

### Requirement: deleteRoute Server Action hard-deletes row and GPX object

The system SHALL expose a Node-runtime Server Action `deleteRoute({ id })` under `features/admin-routes/actions/deleteRoute.ts`. The Action SHALL first `SELECT gpx_path FROM routes WHERE id=$1`, then `DELETE FROM routes WHERE id=$1`, then call `storage.from('gpx').remove([gpx_path])`. The Storage remove SHALL be best-effort: a failure SHALL NOT roll back the row deletion; instead it SHALL emit `console.warn('orphan gpx file', path, e)` and the Action SHALL return `{ ok: true }`. The Action SHALL return `{ ok: true }` when the SELECT finds zero rows (idempotent). After successful deletion the Action SHALL call `revalidatePath` for `/routes`, the deleted slug path, and `/admin/routes`. The Action SHALL return a discriminated union `{ ok: true } | { ok: false, message }`.

#### Scenario: Happy path removes row then Storage object
- **WHEN** `deleteRoute({ id })` is called with the id of an existing route
- **THEN** the Action runs `SELECT gpx_path` followed by `DELETE FROM routes`
- **AND** the row is removed from the `routes` table
- **AND** `storage.from('gpx').remove([gpx_path])` is invoked and the object is removed from the bucket
- **AND** `revalidatePath('/routes')`, `revalidatePath('/routes/' + slug)`, and `revalidatePath('/admin/routes')` are called
- **AND** the Action returns `{ ok: true }`

#### Scenario: Unknown id returns ok (idempotent)
- **WHEN** `deleteRoute({ id })` is called with an id that does not exist
- **THEN** the SELECT returns 0 rows
- **AND** no DELETE or Storage remove is attempted
- **AND** the Action returns `{ ok: true }`

#### Scenario: Storage remove failure is logged but does not fail the Action
- **WHEN** `deleteRoute({ id })` succeeds at row DELETE but `storage.remove` throws
- **THEN** the row is already gone from the `routes` table
- **AND** `console.warn('orphan gpx file', path, e)` is emitted
- **AND** the Action returns `{ ok: true }`

#### Scenario: DB DELETE failure returns explicit error
- **WHEN** `deleteRoute({ id })` is called and the DELETE throws any error
- **THEN** no Storage remove is attempted
- **AND** the Action returns `{ ok: false, message: '刪除失敗' }`

> See: ../../diagrams/02-sequence-delete-route.puml

### Requirement: validateRouteMetadata enforces field-level rules

The system SHALL expose `validateRouteMetadata(input: unknown)` from `lib/admin-routes/validation.ts`. The function SHALL return a discriminated union `{ ok: true, value: RouteMetadataInput } | { ok: false, fieldErrors: Record<string, string> }`. The validator SHALL enforce: `title` required and trimmed length 1–200; `slug` required and matching `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` and length ≤ 80; `description` optional and length ≤ 5000; `region` optional and length ≤ 50; `tags` an array of trimmed, deduplicated, non-empty strings each of length ≤ 30, with at most 20 elements; `difficulty` required and one of `easy` / `medium` / `hard`; `duration_s` optional positive integer; `published` required boolean.

#### Scenario: Valid input returns ok
- **WHEN** `validateRouteMetadata({ title, slug, difficulty, published, ... })` is called with input satisfying every rule
- **THEN** the function returns `{ ok: true, value }` where `value` is the normalised input (title trimmed, tags trimmed/deduped, etc.)

#### Scenario: Invalid slug returns fieldErrors.slug
- **WHEN** `validateRouteMetadata({ slug: 'Foo Bar', ... })` is called (capital letter + space fails the regex)
- **THEN** the function returns `{ ok: false, fieldErrors }` whose `slug` entry is a human-readable error message

#### Scenario: Tag deduplication and trimming
- **WHEN** `validateRouteMetadata({ tags: ['河濱', ' 河濱 ', '', 'LSD'], ... })` is called
- **THEN** the function returns `{ ok: true, value: { tags: ['河濱', 'LSD'] } }`

> See: ../../diagrams/03-activity-action-result-handling.puml

### Requirement: GpxDropzone renders empty / loaded / error visual states

The system SHALL expose a Client Component `<GpxDropzone onFile={fn} />` under `features/admin-routes/GpxDropzone.tsx`. The component SHALL use `validateGpxFile` from `lib/admin-routes/gpxFile.ts` to reject files whose extension is not `.gpx` or whose size exceeds 10 MB. For accepted files the component SHALL call client-side `parseGpx(buffer)` and invoke `onFile(file, parsedMetadata)`. The component SHALL render three visually distinct states matching the Figma reference: an empty state with a dashed border, an upload icon, and the prompt 「拖放 GPX 或點擊選擇」+「.gpx · 上限 10 MB」; a loaded state showing a green-bordered file chip plus map preview plus parsed metadata card; an error state with a danger-coloured border plus icon plus a message such as 「請選 .gpx 檔」 or 「檔案超過 10 MB」.

#### Scenario: Empty state on initial mount
- **WHEN** `<GpxDropzone>` mounts with no file
- **THEN** the rendered DOM shows the dashed-border container with the upload icon and the text 「拖放 GPX 或點擊選擇」 and 「.gpx · 上限 10 MB」

#### Scenario: Loaded state after valid drop
- **WHEN** the user drops a `.gpx` file ≤ 10 MB whose `parseGpx(buffer)` succeeds
- **THEN** the component invokes `onFile(file, parsedMetadata)`
- **AND** the rendered DOM shows the file chip with the filename, size, and a × remove control

#### Scenario: Error state for non-gpx file
- **WHEN** the user drops a file whose extension is not `.gpx`
- **THEN** `onFile` is NOT invoked
- **AND** the rendered DOM shows the danger-bordered container with the message 「請選 .gpx 檔」

#### Scenario: Error state for oversized file
- **WHEN** the user drops a `.gpx` file whose size exceeds 10 MB
- **THEN** `onFile` is NOT invoked
- **AND** the rendered DOM shows the danger-bordered container with the message 「檔案超過 10 MB」

> See: ../../designs/figma.md

### Requirement: AdminTopNav exposes both upload and routes navigation

The system SHALL update `features/admin-auth/AdminTopNav.tsx` so that it renders two navigation links in addition to the existing brand text and sign-out control: 「上傳」 pointing to `/admin/upload` and 「路線管理」 pointing to `/admin/routes`. The link whose href matches the current pathname SHALL be styled with the active treatment (semi-bold weight, accent colour).

#### Scenario: Active link reflects current pathname
- **WHEN** an authenticated admin views `/admin/upload`
- **THEN** the rendered top nav contains anchor `/admin/upload` styled as active
- **AND** the anchor `/admin/routes` is rendered with the inactive treatment (regular weight, fg-muted colour)

#### Scenario: Active link switches on /admin/routes
- **WHEN** an authenticated admin views `/admin/routes`
- **THEN** the anchor `/admin/routes` is styled as active
- **AND** the anchor `/admin/upload` is styled inactive

> See: ../../designs/figma.md

### Requirement: Confirm delete dialog gates the delete Action

The system SHALL expose a Client Component `<DeleteRouteButton id title>` under `features/admin-routes/DeleteRouteButton.tsx`. The component SHALL open a Radix `AlertDialog` when clicked. The dialog body SHALL contain the warning header 「確認刪除路線？」, body text including the route title and `gpx_path`, the emphasis 「此操作不可還原。」, plus a 「取消」 outline button and a 「確認刪除」 danger-coloured button. Only when the user clicks 「確認刪除」 SHALL the component invoke the `deleteRoute({ id })` Server Action.

#### Scenario: Clicking delete opens the confirmation dialog
- **WHEN** the admin clicks the 「刪除」 control on a row
- **THEN** a Radix `AlertDialog` opens centred over a 45 % opaque black backdrop
- **AND** the dialog title is 「確認刪除路線？」
- **AND** the dialog body names the route title and includes the substring `gpx/`

#### Scenario: Cancel closes the dialog without calling the Action
- **WHEN** the admin clicks 「取消」
- **THEN** the dialog closes
- **AND** the `deleteRoute` Server Action is NOT invoked

#### Scenario: Confirm triggers the Action and shows a toast on success
- **WHEN** the admin clicks 「確認刪除」 and `deleteRoute({ id })` returns `{ ok: true }`
- **THEN** the dialog closes
- **AND** the route list is refreshed via `router.refresh()`
- **AND** a sonner toast with text 「已刪除 {title}」 is shown

> See: ../../designs/figma.md
> See: ../../diagrams/02-sequence-delete-route.puml

### Requirement: E2E coverage for admin CRUD flows

The system SHALL include Playwright specs covering the admin upload, edit, and delete flows: an existing `e2e/admin-upload.spec.ts` rewritten to verify a successful upload (rather than the previous "Coming soon" assertion), a new `e2e/admin-route-edit.spec.ts`, and a new `e2e/admin-route-delete.spec.ts`. Each spec SHALL use the Wave-C admin-OAuth fixture and SHALL truncate the `routes` table and `storage.objects` (bucket `gpx`) in `beforeEach`.

#### Scenario: admin-upload e2e exercises the real upload flow
- **WHEN** the `e2e/admin-upload.spec.ts` spec runs under `pnpm test:e2e`
- **THEN** the admin logs in via the OAuth fixture, navigates to `/admin/upload`, drops `e2e/fixtures/sample.gpx`
- **AND** the page renders the map preview and metadata card
- **AND** after submitting the form, the spec lands on `/admin/routes` with the newly created row visible and a sonner toast 「已新增」 present

#### Scenario: admin-route-edit e2e edits and persists metadata
- **WHEN** the `e2e/admin-route-edit.spec.ts` spec runs with one seeded route
- **THEN** the admin navigates from `/admin/routes` to `/admin/routes/{id}`, modifies title and tags, and saves
- **AND** the spec observes the sonner toast 「已儲存」 and the new values prefilled in the form
- **AND** reloading the page shows the new values persisted from the database

#### Scenario: admin-route-delete e2e confirms and verifies deletion
- **WHEN** the `e2e/admin-route-delete.spec.ts` spec runs with one seeded route
- **THEN** the admin clicks 「刪除」, confirms in the `AlertDialog`, and observes the row disappear plus a sonner toast 「已刪除」
- **AND** a follow-up admin query confirms the row is no longer in the `routes` table
- **AND** the corresponding Storage object under `gpx/` is no longer present

> See: ../../designs/figma.md

### Requirement: RouteMetadataForm exposes the canonical metadata fields

The system SHALL render `<RouteMetadataForm>` with the field set `標題 / 網址代稱 (slug) / 描述 / 已發佈` only. The component SHALL NOT render a 「標籤」 field, SHALL NOT import `<TagsInput>`, SHALL NOT accept an `existingTags` prop, and SHALL NOT accept a `routeRegions` prop. The 「途經區域」 read-only surface is rendered by the parent (`UploadPageClient` / `EditPageClient`) via `<RouteRegionsSection>` as a sibling of the form (see route-administrative-regions capability).

#### Scenario: Form renders only the canonical fields

- **WHEN** `<RouteMetadataForm>` mounts in either `mode="create"` or `mode="edit"`
- **THEN** the rendered DOM contains `<label>` elements for 標題 / 網址代稱 (slug) / 描述 / 已發佈
- **AND** the rendered DOM contains NO `<label>` whose text is 「標籤」
- **AND** the component's TypeScript props type contains no `existingTags` key and no `routeRegions` key

> See: ../../designs/figma.md

#### Scenario: Form FormData omits the tags entry

- **WHEN** `buildCreateRouteFormData(values, file)` runs with valid `values`
- **THEN** the resulting `FormData` keys are exactly `{title, slug, description, published, gpxFile}`
- **AND** no `tags` entry is appended

### Requirement: 0009 migration drops routes.tags and its GIN index

The system SHALL provide migration `lib/db/migrations/0009_drop_routes_tags.sql` that executes `DROP INDEX IF EXISTS routes_tags_gin;` followed by `ALTER TABLE routes DROP COLUMN tags;`. The migration body SHALL contain no other DDL.

#### Scenario: Migration drops index then column

- **WHEN** `pnpm db:migrate` runs `0009_drop_routes_tags.sql`
- **THEN** `\d routes` shows no `tags` column
- **AND** `\d routes_tags_gin` returns "Did not find any relation"
- **AND** the migration completes without affecting any other column or index

### Requirement: UploadPageClient phase machine carries elevation + regions preview state

The system SHALL extend `UploadPageClient`'s `Phase.loaded` discriminator to include `elevationProfile: Array<[number, number]>` (the value returned by `parseGpx`) and `regionsState: { kind: 'loading' } | { kind: 'ready'; regions: Region[] } | { kind: 'error'; message: string }`. `handleFile` SHALL seed `elevationProfile` from the parsed result, set `regionsState = { kind: 'loading' }`, then call the new `previewRegions(parsed.geojson)` Server Action (see route-administrative-regions capability) and write the discriminated result back into `regionsState`. A `previewRegions` failure SHALL NOT block submission; the submit button stays enabled.

#### Scenario: Drop triggers elevation seed + previewRegions

- **WHEN** the user drops a valid GPX file into `<GpxDropzone>`
- **THEN** `handleFile(file, parsed)` calls `setPhase` with `kind: 'loaded'`, the parsed `geojson` / `bbox` / `elevationProfile`, and `regionsState: { kind: 'loading' }`
- **AND** `previewRegions(parsed.geojson)` is awaited
- **AND** the resolved result writes back into `regionsState` (`ready` on success, `error` on failure)

#### Scenario: previewRegions failure does not block submit

- **WHEN** `previewRegions` resolves with `{ ok: false, message: '行政區預覽暫時無法使用' }`
- **THEN** `regionsState.kind === 'error'`
- **AND** the form's 「儲存」 submit button remains enabled
- **AND** the user can still submit the route, after which `createRoute` re-runs `detectRegions` server-side as the source of truth

> See: ../../designs/figma.md

