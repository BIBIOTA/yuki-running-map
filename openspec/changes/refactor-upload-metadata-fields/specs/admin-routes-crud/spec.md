## REMOVED Requirements

### Requirement: Existing tags are prefetched for the admin upload page

**Reason**: 標籤欄位整條鏈（UI、validation、DB、index、test）拆除。`/admin/upload` 不再呼叫 `listExistingTags`，`<UploadPageClient>` 不再接收 `existingTags` prop。

**Migration**: `app/(admin)/admin/upload/page.tsx` 移除 `import { listExistingTags }` 與 `existingTags={await listExistingTags(db)}` 傳遞。`<TagsInput>` 元件不再被引用 → 連同 `features/admin-routes/TagsInput.tsx`、`features/admin-routes/tags.ts`、`features/admin-routes/__tests__/tags.test.ts`、`lib/admin-routes/listExistingTags.ts`、`lib/admin-routes/__tests__/listExistingTags.integration.test.ts` 一併刪除。

### Requirement: routes table stores tags as text array

**Reason**: 此欄位已無使用者 surface，留著只會增加 schema、index 與測試成本。

**Migration**: `lib/db/migrations/0009_drop_routes_tags.sql` 先 `DROP INDEX IF EXISTS routes_tags_gin;` 再 `ALTER TABLE routes DROP COLUMN tags;`。`lib/db/schema.ts` 同步移除 `tags: text("tags").array()...` 與 `index("routes_tags_gin").using("gin", t.tags)`。`validateRouteMetadata` 與 `createRoute` / `updateRoute` 隨之移除 `tags` 解析、驗證與寫入。

## MODIFIED Requirements

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

### Requirement: createRoute Server Action persists metadata + GPX-derived columns

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

### Requirement: updateRoute Server Action updates allow-listed metadata fields

The system SHALL provide an `updateRoute(id, payload)` Server Action whose `ACCEPTED_FIELDS` allow list is exactly `["title", "slug", "description", "published"]`. The Action SHALL NOT include `"tags"` in `ACCEPTED_FIELDS` and SHALL NOT UPDATE the `routes.tags` column.

#### Scenario: Update payload containing extraneous keys ignores them

- **WHEN** `updateRoute(id, { title: "新", tags: ["x"], published: true })` runs
- **THEN** the UPDATE SET clause sets only `title` and `published`
- **AND** the SET clause does NOT mention `tags`

> See: ../../designs/figma.md

## ADDED Requirements

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
