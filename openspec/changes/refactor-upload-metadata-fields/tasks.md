# Tasks: refactor-upload-metadata-fields

## 1. Schema migration: drop routes.tags
- [x] 1.1 Write `lib/db/migrations/0009_drop_routes_tags.sql`
  - Acceptance: WHEN the migration file is loaded THEN it contains `DROP INDEX IF EXISTS routes_tags_gin;` followed by `ALTER TABLE routes DROP COLUMN tags;` AND no other DDL.
  - Depends on: -
  - Independence: independent
  - status: passing
- [ ] 1.2 Remove `tags` column + `routes_tags_gin` index from `lib/db/schema.ts`
  - Acceptance: WHEN `pnpm typecheck` runs THEN `routes.tags` is no longer present on the inferred type AND the `routes_tags_gin` `.using('gin', t.tags)` line is gone.
  - Depends on: 1.1
  - Independence: serial
  - status: not_started
- [ ] 1.3 Apply migration locally via `pnpm db:migrate`
  - Acceptance: WHEN the local Supabase DB is migrated THEN `\d routes` shows no `tags` column AND no `routes_tags_gin` index.
  - Depends on: 1.1, 1.2
  - Independence: serial
  - status: not_started

## 2. `previewRegions` read-only Server Action
- [x] 2.1 Create `features/admin-routes/actions/previewRegions.ts`
  - Acceptance: WHEN the file is imported THEN it exports `previewRegions(geometry: { type: 'LineString'; coordinates: Array<[number, number]> }): Promise<PreviewRegionsResult>` with discriminated union `{ ok: true; regions: Region[] } | { ok: false; message: string }` AND uses `"use server"` directive AND calls `lib/admin-routes/detectRegions` with the geometry AND joins against `adminUnits` to return `Region[]` (code/level/name/parent_code).
  - Depends on: -
  - Independence: independent
  - Figma: regions slot three states (designs/figma.md frame "regions-states")
  - status: passing
- [x] 2.2 Add unit test `features/admin-routes/actions/__tests__/previewRegions.test.ts`
  - Acceptance: WHEN vitest runs THEN tests cover (a) malformed LineString → `ok:false, message: '預覽參數錯誤'`; (b) mocked `detectRegions` throw → `ok:false, message: '行政區預覽暫時無法使用'`; (c) happy path returns `Region[]` matching DB rows.
  - Depends on: 2.1
  - Independence: serial
  - status: passing

## 3. `UploadPageClient` rewire: elevation profile + regions slot
- [ ] 3.1 Extend `Phase.loaded` discriminator
  - Acceptance: WHEN `UploadPageClient` is read THEN `Phase.loaded` includes `elevationProfile: Array<[number, number]>` AND `regionsState: { kind: 'loading' } | { kind: 'ready'; regions: Region[] } | { kind: 'error'; message: string }`.
  - Depends on: -
  - Independence: independent
  - status: not_started
- [ ] 3.2 Update `handleFile` to seed `elevationProfile` + trigger `previewRegions`
  - Acceptance: WHEN a GPX is dropped THEN `setPhase` initialises `elevationProfile` from `parsed.elevationProfile` AND `regionsState = { kind: 'loading' }`; THEN `previewRegions(parsed.geojson)` is awaited and the resolved result writes back into `regionsState`.
  - Depends on: 2.1, 3.1
  - Independence: serial
  - Figma: upload preview layout (designs/figma.md frame "upload-preview")
  - status: not_started
- [ ] 3.3 Render `<ElevationProfile profile={phase.elevationProfile} />` below the map preview
  - Acceptance: WHEN `phase.kind === 'loaded'` THEN the component renders inside a `<section aria-labelledby="upload-elevation-heading">` with heading 「海拔曲線」 AND the section sits between `<RouteMapPreview>` and `<RouteMetadataForm>` AND honours the same `border-border bg-card` card chrome used on `/routes/[slug]`.
  - Depends on: 3.1
  - Independence: serial
  - Figma: upload preview layout (designs/figma.md frame "upload-preview")
  - status: not_started
- [ ] 3.4 Render regions slot with four-state UI (`loading | ready | ready-empty | error`)
  - Acceptance: WHEN `regionsState.kind === 'loading'` THEN a paragraph-shaped skeleton line + 「正在判斷區域…」 hint render inside `<RouteRegionsSection>` with `data-testid="upload-regions-state"` and `data-state="loading"`; WHEN `'ready'` and `regions.length > 0` THEN `<RouteRegions variant="stacked" regions={...} />` renders with `data-state="ready"` (paragraph form, NOT chips — see designs/figma.md AC-4); WHEN `'ready'` and `regions.length === 0` THEN a muted-text hint 「此路線未涵蓋任何已知行政區。」 renders with `data-state="ready-empty"`; WHEN `'error'` THEN a red-tinted alert 「✕ 無法預覽區域」 with body 「行政區預覽暫時無法使用…」 renders with `data-state="error"` AND the submit button stays enabled.
  - Depends on: 3.1, 3.5
  - Independence: serial
  - Figma: regions slot four states (designs/figma.md frames 02-05)
  - status: not_started
- [ ] 3.5 Extract `<RouteRegionsSection>` shared chrome
  - Acceptance: WHEN the public detail page (`app/(public)/routes/[slug]/page.tsx`) is read THEN the `<section aria-labelledby="regions-heading">` + 「途經區域」 `<h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">` wrapper is moved into a new exported `<RouteRegionsSection>` co-located with `<RouteRegions>` in `components/RouteRegions.tsx`; WHEN the upload preview, edit page, and public detail page render their regions block THEN they all import and use `<RouteRegionsSection>` so the heading chrome cannot drift; WHEN the public detail page has `regions.length === 0` THEN `<RouteRegionsSection>` returns `null` (matches existing detail behaviour); WHEN the upload preview has `regions.length === 0` in `ready` state THEN `<RouteRegionsSection>` renders the heading + admin-only empty hint (so the empty-state copy diverges by surface, while the heading chrome stays identical); WHEN `RouteMetadataForm` is read THEN the inline 「途經區域」 block (with `<span className="text-sm font-medium">途經區域</span>` + `<RouteRegions />`) is REMOVED along with the `routeRegions` prop — the parent (`UploadPageClient` / `EditPageClient`) now renders `<RouteRegionsSection>` as a sibling of the form (not inside it) so all surfaces share the same chrome.
  - Depends on: -
  - Independence: independent
  - Figma: designs/figma.md AC-3 + Implementation note
  - status: in_progress

## 4. `RouteMetadataForm` + form-state cleanup (drop tags)
- [ ] 4.1 Remove 「標籤」 `<Field>` and `<TagsInput>` from `RouteMetadataForm`
  - Acceptance: WHEN the component is rendered THEN there is no `<Field label="標籤" …>` AND no `import { TagsInput }` AND no `existingTags` prop in the `Props` type.
  - Depends on: -
  - Independence: independent
  - status: not_started
- [ ] 4.2 Drop `tags` from `RouteMetadataValues` and form initial state
  - Acceptance: WHEN `features/admin-routes/types.ts` is read THEN `RouteMetadataValues` has keys `{ title, slug, description, published }` only; WHEN `buildInitialValues` runs THEN the returned object omits `tags`.
  - Depends on: 4.1
  - Independence: serial
  - status: not_started
- [ ] 4.3 Drop `tags` from `uploadPageState.buildCreateRouteFormData`
  - Acceptance: WHEN the function is called THEN the resulting `FormData` keys are exactly `title`, `slug`, `description`, `published`, `gpxFile` AND no `tags` entry.
  - Depends on: 4.2
  - Independence: serial
  - status: not_started
- [ ] 4.4 Drop `tags` from `editPageState`
  - Acceptance: WHEN `buildEditFormValues` runs on a `Route` row THEN the returned object has no `tags`; WHEN `buildPayload` runs THEN the payload sent to `updateRoute` has no `tags` key.
  - Depends on: 4.2
  - Independence: serial
  - status: not_started

## 5. `EditPageClient`: drop tags wiring + add elevation profile
- [ ] 5.1 Remove `existingTags` prop from `EditPageClient`
  - Acceptance: WHEN the component is read THEN it no longer takes `existingTags` AND does not forward it to `RouteMetadataForm`.
  - Depends on: 4.1
  - Independence: serial
  - status: not_started
- [ ] 5.2 Mount `<ElevationProfile profile={route.elevationProfile} />` below the map preview
  - Acceptance: WHEN the edit page renders THEN the component appears inside `<section aria-labelledby="edit-elevation-heading">` with heading 「海拔曲線」 directly below `<RouteMapPreview>` AND uses the same card chrome as the public detail page.
  - Depends on: -
  - Independence: independent
  - Figma: upload preview layout (designs/figma.md frame "upload-preview") — edit page reuses same slot layout
  - status: not_started

## 6. Server-action + validation cleanup (drop tags)
- [ ] 6.1 Remove tags from `createRoute`
  - Acceptance: WHEN `createRoute` runs THEN `parseMetadataFromFormData` no longer reads `tags` AND the INSERT values object omits `tags` AND no `fieldErrors.tags` branch exists.
  - Depends on: 1.2, 4.3
  - Independence: serial
  - status: not_started
- [ ] 6.2 Remove tags from `updateRoute`
  - Acceptance: WHEN `updateRoute` runs THEN `ACCEPTED_FIELDS` does not contain `"tags"` AND no `meta.tags` reference exists in the UPDATE payload.
  - Depends on: 1.2, 4.4
  - Independence: serial
  - status: not_started
- [ ] 6.3 Remove tags from `lib/admin-routes/validation.ts`
  - Acceptance: WHEN `validateRouteMetadata` is read THEN `RouteMetadataInput` has no `tags` field AND no tags branch in the validation body AND `RouteMetadataValue` (the success-shape) has no `tags`.
  - Depends on: 4.2
  - Independence: serial
  - status: not_started

## 7. Page-level cleanup
- [ ] 7.1 `app/(admin)/admin/upload/page.tsx`: drop `listExistingTags`
  - Acceptance: WHEN the page is read THEN there is no `import { listExistingTags }` AND no `existingTags` prop is passed to `<UploadPageClient>`.
  - Depends on: 4.1
  - Independence: serial
  - status: not_started
- [ ] 7.2 `app/(admin)/admin/routes/[id]/page.tsx`: drop `listExistingTags`
  - Acceptance: WHEN the page is read THEN there is no `import { listExistingTags }`, no `Promise.all`-bundled call, and no `existingTags` prop on `<EditPageClient>`.
  - Depends on: 5.1
  - Independence: serial
  - status: not_started

## 8. Deletions
- [ ] 8.1 Delete `features/admin-routes/TagsInput.tsx`
  - Acceptance: WHEN the repo is scanned THEN the file does not exist AND `pnpm typecheck` passes (no orphan imports).
  - Depends on: 4.1
  - Independence: serial
  - status: not_started
- [ ] 8.2 Delete `features/admin-routes/tags.ts` + `__tests__/tags.test.ts`
  - Acceptance: WHEN the repo is scanned THEN both files are absent AND no other file imports `addTag`, `removeTagAt`, or `filterSuggestions`.
  - Depends on: 4.1, 8.1
  - Independence: serial
  - status: not_started
- [ ] 8.3 Delete `lib/admin-routes/listExistingTags.ts` + `__tests__/listExistingTags.integration.test.ts`
  - Acceptance: WHEN the repo is scanned THEN both files are absent AND no caller imports `listExistingTags`.
  - Depends on: 7.1, 7.2
  - Independence: serial
  - status: not_started

## 9. Test updates
- [ ] 9.1 Update `features/admin-routes/__tests__/uploadPageState.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags` AND a new assertion verifies the FormData keys set is exactly `{ title, slug, description, published, gpxFile }`.
  - Depends on: 4.3
  - Independence: serial
  - status: not_started
- [ ] 9.2 Update `features/admin-routes/__tests__/routeMetadataFormState.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags` AND `buildInitialValues` cases assert the new minimal shape.
  - Depends on: 4.2
  - Independence: serial
  - status: not_started
- [ ] 9.3 Update `features/admin-routes/__tests__/editPageState.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags`.
  - Depends on: 4.4
  - Independence: serial
  - status: not_started
- [ ] 9.4 Update `lib/admin-routes/__tests__/validation.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags` AND coverage for title / slug / description / published remains green.
  - Depends on: 6.3
  - Independence: serial
  - status: not_started
- [ ] 9.5 Update `features/admin-routes/actions/__tests__/createRoute.integration.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags`, the INSERT-row assertion lists no `tags` column, AND a schema-existence assertion confirms `routes.tags` and `routes_tags_gin` are absent.
  - Depends on: 1.3, 6.1
  - Independence: serial
  - status: not_started
- [ ] 9.6 Update `features/admin-routes/actions/__tests__/updateRoute.integration.test.ts`
  - Acceptance: WHEN vitest runs THEN no test references `tags` AND the `ACCEPTED_FIELDS` assertion lists `["title","slug","description","published"]` only.
  - Depends on: 1.3, 6.2
  - Independence: serial
  - status: not_started

## 10. E2E updates
- [ ] 10.1 Update `e2e/admin-upload.spec.ts`
  - Acceptance: WHEN Playwright runs THEN the spec (a) no longer fills a 「標籤」 field; (b) asserts `[data-testid="elevation-profile"]` OR `[data-testid="elevation-empty"]` is visible after the GPX is dropped; (c) asserts `[data-testid="upload-regions-state"]` transitions from `data-state="loading"` to `data-state="ready"` (or `ready-empty`); (d) after submission, asserts the routes list page shows the same region chips.
  - Depends on: 3.3, 3.4, 6.1
  - Independence: serial
  - Figma: upload preview layout (designs/figma.md frame "upload-preview"); regions slot three states (designs/figma.md frame "regions-states")
  - status: not_started
- [ ] 10.2 Update `e2e/admin-route-edit.spec.ts`
  - Acceptance: WHEN Playwright runs THEN the spec asserts (a) `[data-testid="elevation-profile"]` OR `[data-testid="elevation-empty"]` is visible AND (b) no 「標籤」 label exists on the edit form AND (c) any prior tag-typeahead steps are removed.
  - Depends on: 5.2, 6.2
  - Independence: serial
  - Figma: upload preview layout (designs/figma.md frame "upload-preview")
  - status: not_started
- [ ] 10.3 Remove residual tag assertions in other E2E specs
  - Acceptance: WHEN `rg "標籤|tags" e2e/` runs THEN only acceptable matches remain (e.g. a comment explaining the removal); no spec interacts with a tag UI control.
  - Depends on: 10.1, 10.2
  - Independence: serial
  - status: not_started

## 11. Verification
- [ ] 11.1 `pnpm typecheck`
  - Acceptance: WHEN run on the working tree THEN exit code 0 AND no orphan `tags` references anywhere.
  - Depends on: all preceding tasks
  - Independence: serial
  - status: not_started
- [ ] 11.2 `pnpm lint`
  - Acceptance: WHEN run THEN exit code 0.
  - Depends on: 11.1
  - Independence: serial
  - status: not_started
- [ ] 11.3 `pnpm format:check`
  - Acceptance: WHEN run THEN exit code 0.
  - Depends on: 11.1
  - Independence: serial
  - status: not_started
- [ ] 11.4 `pnpm test`
  - Acceptance: WHEN run THEN all vitest specs pass AND no `tags` assertions remain.
  - Depends on: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 2.2
  - Independence: serial
  - status: not_started
- [ ] 11.5 `pnpm test:e2e`
  - Acceptance: WHEN run against a freshly migrated local DB + seeded admin_units THEN all 5 specs pass.
  - Depends on: 10.1, 10.2, 10.3, 11.4
  - Independence: serial
  - status: not_started
- [ ] 11.6 `openspec validate --strict refactor-upload-metadata-fields`
  - Acceptance: WHEN run THEN exit code 0.
  - Depends on: writing-spec output exists
  - Independence: serial
  - status: not_started

## Optional artifacts
- [ ] PlantUML diagrams (spec-driven-dev:writing-uml) — not selected
- [x] Figma designs (spec-driven-dev:writing-figma) — required frames:
  - `upload-preview` — full loaded layout (RouteMapPreview / ElevationProfile / RouteRegions / RouteMetadataForm minus tags)
  - `regions-states` — `loading`, `ready` (≥1 region), `ready-empty` (0 regions), `error`
