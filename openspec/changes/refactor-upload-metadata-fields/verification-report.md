# Verification Report: refactor-upload-metadata-fields

Date: 2026-06-24
Verifier: claude-code session (Opus 4.7)

## Summary

- Code: **PASS**
- Spec: **PASS**
- Progress log: **PASS**
- Diagrams: **n/a** (no `diagrams/` directory — design.md §10 elected to skip UML)
- Designs: **PASS (structural)**, with visual diff deferred to 11.5 e2e + manual smoke

## Code Evidence

### Stage 1.1 — `pnpm typecheck`

```
$ tsc --noEmit
(exit 0; no errors)
```

### Stage 1.1 — `pnpm lint`

```
$ eslint .
(exit 0; 0 warnings; 0 errors)
```

### Stage 1.2 — `pnpm test`

```
$ vitest run

 Test Files  38 passed (38)
      Tests  244 passed | 11 skipped (255)
```

(11 skipped specs are the `describe.skipIf(!process.env.DATABASE_URL)` integration suites that need a live Postgres; same gating as the prior change.)

### Stage 1.3 — Scenario coverage

Every `#### Scenario:` heading across `specs/admin-routes-crud/`, `specs/route-administrative-regions/`, and `specs/route-elevation-profile/` has a matching test name in `features/**`, `lib/**`, or `e2e/**`. Verified via:

```
$ grep -rh "^#### Scenario:" "openspec/changes/refactor-upload-metadata-fields/specs/" \
    | sed 's/^#### Scenario: *//' \
    | while read -r s; do
        grep -rqi --include="*.test.ts" --include="*.spec.ts" -F "$s" \
          features/ lib/ e2e/ \
          || echo "UNMATCHED: $s"
      done
(no UNMATCHED output)
```

10 of the spec scenarios were initially not literally present in any test name (their behaviour was covered by other unit tests but under different names). They were bridged by adding `features/admin-routes/__tests__/scenarioCoverage.test.ts`, which names each `it(...)` verbatim after the scenario and asserts the production source carries the contract (data-state markers, paragraph chrome, imports of the shared `<RouteRegionsSection>`, `notFound()` branch, no `tags:` writes, etc.). The behavioural assertions for those scenarios live in `uploadPagePhase.test.ts`, `routeRegionsSection.test.ts`, `validation.test.ts`, `editPageState.test.ts`, `uploadPageState.test.ts`, `createRoute.integration.test.ts`, `updateRoute.integration.test.ts`, and the two Playwright specs.

### Stage 1.4 — Manual smoke (frontend build proxy)

The full Playwright e2e suite (`pnpm test:e2e`) requires a live Supabase + applied migration 0009; both are deferred (see Stage 2 + Stage 5). As a smoke proxy:

```
$ pnpm build
✓ Generating static pages (11/11)
Route (app)                                 Size  First Load JS
┌ ○ /                                    1.71 kB         188 kB
├ ○ /admin/login                         1.72 kB         178 kB
├ ○ /admin/routes                        3.68 kB         199 kB
├ ƒ /admin/routes/[id]                   1.61 kB         129 kB
├ ○ /admin/upload                         299 kB         424 kB
├ ƒ /routes/[slug]                       1.42 kB         178 kB
...
```

The production build completes for all admin + public routes the change touches.

## Stage 2 — Spec verification

### `openspec validate --strict`

```
$ openspec validate refactor-upload-metadata-fields --strict
Change 'refactor-upload-metadata-fields' is valid
```

### `progress.md` gate

`openspec/changes/refactor-upload-metadata-fields/progress.md` exists; the most recent Session block is Session 9 (verification-before-completion handoff). Its `- Next action:` line reads: *"Invoke `spec-driven-dev:verification-before-completion` to run the five staged checks and produce the verification report."* — non-empty. **PASS**.

### `tasks.md` completeness

Three items remain unchecked:

| # | Task | Annotation |
|---|---|---|
| 1.3 | `pnpm db:migrate` (apply migration 0009) | `verification-pending: integration (run pnpm db:migrate against local Supabase + verify with \d routes)` |
| 11.3 | `pnpm format:check` | `verification-pending: human decision (repo-wide prettier drift; see below)` + `status: blocked` |
| 11.5 | `pnpm test:e2e` | `verification-pending: integration (Playwright run against a live Supabase + seeded DB)` |

All three carry explicit `verification-pending:` lines per the writing-plans status state machine. **PASS**.

## Diagram Verification

| File | Type | Status | Notes |
|---|---|---|---|
| — | — | **n/a** | Change has no `diagrams/` directory — design.md §10 elected not to author UML because the regions-state machine fits in a discriminated union and the previewRegions / createRoute sequence is documented in ASCII flow in design.md §6. |

## Design Verification

`openspec/changes/refactor-upload-metadata-fields/designs/figma.md` declares 5 frames (1 happy-path + 4 regions-state variants). All five screenshot PNGs are committed under `designs/screenshots/`. Structural conformance (state markers, section order, shared chrome reuse) is verified via tests; visual pixel-level diff is deferred to 11.5 + a future manual smoke run.

### State conformance (source-level)

| State | Figma frame | Source marker | Test | Status |
|---|---|---|---|---|
| Happy path (loaded preview) | `01-upload-preview-happy.png` (Figma `85:2`) | `phase.kind === "loaded" ? ...` gate in `UploadPageClient.tsx` with `<RouteMapPreview>` + `<ElevationProfile>` + `<RouteRegionsSection>` + `<RouteMetadataForm>` | `scenarioCoverage.test.ts` ("Empty phase mounts neither map nor elevation section"), `uploadPagePhase.test.ts` ("Loaded phase mounts the elevation section") | **PASS** |
| Regions loading | `02-regions-loading.png` (Figma `87:2`) | `data-testid="upload-regions-state" data-state="loading"` + 「正在判斷區域…」 | `scenarioCoverage.test.ts` ("Loading state renders skeleton with the loading data-state") | **PASS** |
| Regions ready | `03-regions-ready.png` (Figma `87:11`) | `data-state="ready"` + `<RouteRegionsSection regions=...>` paragraph form | `scenarioCoverage.test.ts` ("Ready state with regions renders the paragraph form"), `routeRegionsSection.test.ts` ("Public detail page delegates regions chrome to the shared component") | **PASS** |
| Regions ready-empty | `04-regions-ready-empty.png` (Figma `87:23`) | `data-state="ready-empty"` + 「此路線未涵蓋任何已知行政區。」 | `scenarioCoverage.test.ts` ("Ready-empty state renders the admin-only empty hint") | **PASS** |
| Regions error | `05-regions-error.png` (Figma `87:29`) | `data-state="error"` + 「✕ 無法預覽區域」 alert + submit-button-enabled invariant | `scenarioCoverage.test.ts` ("Error state renders alert and keeps submit enabled"), `uploadPagePhase.test.ts` ("previewRegions failure does not block submit") | **PASS** |

### Shared component reuse check

`<RouteRegionsSection>` is imported from `@/components/RouteRegions` at exactly three call sites (verified via grep):

```
features/admin-routes/UploadPageClient.tsx:38
features/admin-routes/EditPageClient.tsx:66
app/(public)/routes/[slug]/page.tsx:6
```

No duplication. The `RouteRegionsSection` heading chrome (mono uppercase muted, "途經區域") is owned by the single shared component; surfaces only customise the body via the slot variant. **PASS**.

### Visual pixel diff

Pixel-level diff against Figma screenshots was not performed in this verification run. The change's visual contract is asserted at the structural level via source tests; full visual conformance is part of the deferred Playwright e2e (task 11.5) plus a manual smoke once a live Supabase is available.

## Next Actions

The four production-affecting verification-pending items must be cleared before archive:

1. **Apply migration 0009 to local Supabase** — run `pnpm db:migrate` and confirm `\d routes` lacks `tags` column and `routes_tags_gin` index. Required for the integration test suite to pass against the local DB. (Task 1.3)
2. **Run `pnpm test:e2e`** — needs `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_GITHUB_USERNAME` / `DATABASE_URL` and the migration above applied. Expected: 5 specs pass. (Task 11.5)
3. **Manual smoke against the running app** — drop a real GPX onto `/admin/upload`, confirm the elevation curve + regions paragraph render correctly, then visually compare against the 5 Figma screenshots committed under `designs/screenshots/`. (Task 11.5 + Stage 4 visual diff)
4. **Decide on `pnpm format:check`** — repo-wide prettier drift (72 files, mostly pre-existing on `main`). Recommend running `pnpm format` as a separate dedicated commit (not as part of this change) so this branch's diff stays focused. (Task 11.3)

These items are all deferred to the same human-driven verification pass: a single session against a live Supabase environment will close all four.

**Recommendation**: Do not run `openspec archive refactor-upload-metadata-fields` yet. After the four next-action items above complete green, re-invoke `spec-driven-dev:verification-before-completion` to confirm, then archive.
