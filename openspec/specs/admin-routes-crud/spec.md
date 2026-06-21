# admin-routes-crud Specification

## Purpose
TBD - created by archiving change feat-admin-gpx-upload. Update Purpose after archive.
## Requirements
### Requirement: /admin/upload renders the real GPX upload UI

The system SHALL serve `/admin/upload` to authenticated admin as a Server-rendered Node-runtime page that prefetches existing tags via `listExistingTags(db)` and renders `<UploadPageClient existingTags={...} />`. The page SHALL replace the previous "Coming soon · GPX 上傳開發中" placeholder. Unauthenticated or non-admin clients SHALL continue to be intercepted by the existing admin middleware (`middleware.ts`) as defined in the `data-and-auth-infrastructure` capability.

#### Scenario: Authenticated admin sees the real upload UI
- **WHEN** an authenticated admin sends GET `/admin/upload`
- **THEN** the response status is 200
- **AND** the page renders the admin top nav with `上傳` link styled as active
- **AND** the body renders the `<UploadPageClient>` component containing `<GpxDropzone>` in its empty state
- **AND** the rendered HTML does NOT contain the text "Coming soon · GPX 上傳開發中"

#### Scenario: Existing tags are prefetched
- **WHEN** an authenticated admin sends GET `/admin/upload`
- **THEN** the page server-side calls `listExistingTags(db)` and passes the result into `<UploadPageClient existingTags={...} />`
- **AND** the tag list is available to `<TagsInput>` for typeahead suggestions without an additional client round-trip

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

The system SHALL serve `/admin/routes/[id]` to authenticated admin as a Server-rendered Node-runtime page that selects the route by id (admin RLS), prefetches existing tags via `listExistingTags(db)`, and renders `<EditPageClient initial={route} existingTags={...} />`. If the id does not match any row the page SHALL call `notFound()` and return 404. The edit form SHALL expose only metadata fields and SHALL NOT render GPX-derived fields (`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `recorded_at` / `id` / `created_at`); those values SHALL appear in a separate READ-ONLY card on the page.

#### Scenario: Admin opens edit page for existing route
- **WHEN** an authenticated admin sends GET `/admin/routes/{existing-id}`
- **THEN** the response status is 200
- **AND** the page renders breadcrumb 「路線管理 / 編輯」 followed by hero 「編輯路線 · {title}」
- **AND** the left column renders editable fields title / slug / description / region / tags / difficulty / duration / published toggle, prefilled with the route's current values
- **AND** the right column renders a READ-ONLY card titled 「GPX 衍生（鎖定）」 containing 距離 / 累積爬升 / 軌跡點數 / 紀錄時間 / gpx_path

#### Scenario: Edit page for unknown id returns 404
- **WHEN** an authenticated admin sends GET `/admin/routes/{nonexistent-id}`
- **THEN** the response status is 404
- **AND** the page invokes Next.js `notFound()`

> See: ../../designs/figma.md

### Requirement: createRoute Server Action persists the new route with rollback

The system SHALL expose a Node-runtime Server Action `createRoute(formData)` under `features/admin-routes/actions/createRoute.ts`. The Action SHALL validate metadata via `validateRouteMetadata`, server-side parse the GPX via `parseGpx(buffer)`, upload the buffer to `gpx/{yyyy}/{uuid}.gpx` in the `gpx` Storage bucket, INSERT into `routes`, and call `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')` before returning. On any failure between Storage upload and INSERT completion the Action SHALL invoke `supabase.storage.from('gpx').remove([path])` to rollback. The Action SHALL return a discriminated union `{ ok: true, id, slug } | { ok: false, fieldErrors }` and SHALL NOT throw across the client boundary; client metadata SHALL NOT be trusted for GPX-derived columns (all GPX-derived values come from the server-side `parseGpx` result).

#### Scenario: Happy path creates row and Storage object
- **WHEN** an authenticated admin calls `createRoute(formData)` with a valid GPX file and complete metadata
- **THEN** the GPX buffer is uploaded to `gpx/{yyyy}/{uuid}.gpx`
- **AND** a new row is INSERTed into `routes` with `gpx_path` matching the upload path and `distance_m` / `elevation_gain_m` / `bbox` / `start_point` / `geojson` / `recorded_at` derived from the server-side `parseGpx(buffer)` call
- **AND** `revalidatePath('/routes')`, `revalidatePath('/routes/' + slug)`, and `revalidatePath('/admin/routes')` are called
- **AND** the Action returns `{ ok: true, id, slug }`

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

#### Scenario: Slug UNIQUE conflict rolls back Storage upload
- **WHEN** `createRoute(formData)` succeeds at Storage upload but the subsequent INSERT throws a `postgres` error with code `23505` matching constraint `routes_slug_unique`
- **THEN** `storage.from('gpx').remove([path])` is invoked to delete the uploaded object
- **AND** the Action returns `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`

#### Scenario: Other INSERT failure rolls back Storage and reports _form
- **WHEN** `createRoute(formData)` succeeds at Storage upload but the subsequent INSERT throws any other error
- **THEN** `storage.from('gpx').remove([path])` is invoked
- **AND** the Action returns `{ ok: false, fieldErrors: { _form: '寫入失敗：...' } }`
- **AND** `console.error(e)` is called

> See: ../../diagrams/01-sequence-create-route.puml
> See: ../../diagrams/03-activity-action-result-handling.puml

### Requirement: updateRoute Server Action mutates metadata only

The system SHALL expose a Node-runtime Server Action `updateRoute({ id, ...meta })` under `features/admin-routes/actions/updateRoute.ts`. The Action SHALL validate metadata via `validateRouteMetadata`, fetch the current slug from the database (`SELECT slug FROM routes WHERE id=$1`), UPDATE the row's metadata columns with the validated input plus `updated_at = now()`, and call `revalidatePath` for `/routes`, the old slug path (if changed), the new slug path, and `/admin/routes` before returning. The Action SHALL strip the GPX-derived keys (`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` / `elevation_gain_m` / `recorded_at` / `id` / `created_at`) from the input before UPDATE. Failures SHALL return a discriminated union `{ ok: true } | { ok: false, fieldErrors }`.

#### Scenario: Happy path updates metadata and revalidates both slug paths
- **WHEN** `updateRoute({ id, ...validMeta })` is called with metadata that includes a slug different from the stored value
- **THEN** the Action runs `SELECT slug FROM routes WHERE id=$1` to obtain `oldSlug`
- **AND** the Action runs UPDATE with the validated metadata (GPX-derived keys stripped) plus `updated_at = now()`
- **AND** the Action calls `revalidatePath('/routes')`, `revalidatePath('/routes/' + oldSlug)`, `revalidatePath('/routes/' + newSlug)`, and `revalidatePath('/admin/routes')`
- **AND** the Action returns `{ ok: true }`

#### Scenario: GPX-derived keys sent by client are silently stripped
- **WHEN** the client submits a form whose payload includes `gpx_path` or any other GPX-derived column
- **THEN** the Action removes those keys from the input before UPDATE
- **AND** the corresponding database columns retain their existing values

#### Scenario: Slug UNIQUE conflict surfaces fieldErrors.slug
- **WHEN** `updateRoute({ id, ...meta })` triggers a `postgres` 23505 error on `routes_slug_unique`
- **THEN** the Action returns `{ ok: false, fieldErrors: { slug: '此 slug 已被使用' } }`

> See: ../../diagrams/03-activity-action-result-handling.puml

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

