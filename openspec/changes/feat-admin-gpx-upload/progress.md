---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

# Progress: feat-admin-gpx-upload

> SDD execution log. One Session block per status transition. Source of truth for
> task state is `tasks.md`; this file records the audit trail + reviewer outcomes.

## Environment note (2026-06-19)

本機無 `.env.local`、無 Supabase CLI、無 local Supabase stack。依使用者指示
（「Write code+tests, don't run」）：純函式 / UI typecheck 類 task 在本機完整跑過
review gate；需要 local Supabase 的 integration（1.3 / 2.x）與 e2e（5.x）task 仍
撰寫 code + tests 並 commit，但其執行驗證標記為 **VERIFICATION-PENDING**（待 CI /
Supabase 起來後執行），不在本機偽造通過。

## Session 1 — 2026-06-19 21:00
- Stage: SDD
- Task: 1.1 Add `lib/admin-routes/validation.ts` with `validateRouteMetadata`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `validateRouteMetadata` + unit tests per design.md §6.1.

## Session 2 — 2026-06-19 23:40
- Stage: SDD
- Task: 1.1 Add `lib/admin-routes/validation.ts` with `validateRouteMetadata`
- Transition: in_progress → passing
- Evidence:
  - Commits: fe447a1 feat(admin-routes): add validateRouteMetadata field-level validator
  - Tests: `pnpm test -- lib/admin-routes/__tests__/validation.test.ts` → 52/52 pass; coverage Stmts 95.23% / Branches 91.66% / Funcs 100% / Lines 95% on `lib/admin-routes/validation.ts` (≥ 80% threshold)
  - Typecheck: `pnpm typecheck` exit 0
  - Spec-reviewer: APPROVE — 5/5 checks pass (scenario coverage with named `describe` blocks, discriminated-union shape matches activity diagram, all §6.1 rules enforced with ≥2 cases, no extra features, no missing clauses)
  - Code-quality-reviewer: APPROVE — no Critical/Important; minor DRY observation on `description`/`region` optional-trimmed-text pattern and boundary-equality positive tests (logged for follow-up, not blocking)
- Next action: Resume SDD on task 1.2 `lib/admin-routes/gpxFile.ts` (validateGpxFile + derivePathFromUuid) once user confirms.

## Session 3 — 2026-06-19 23:55
- Stage: SDD
- Task: 1.2 Add `lib/admin-routes/gpxFile.ts` with `validateGpxFile` + `derivePathFromUuid`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `validateGpxFile(file)` + `derivePathFromUuid(date, uuid)` + unit tests per tasks.md 1.2 acceptance.

## Session 4 — 2026-06-20 00:10
- Stage: SDD
- Task: 1.2 Add `lib/admin-routes/gpxFile.ts` with `validateGpxFile` + `derivePathFromUuid`
- Transition: in_progress → passing
- Evidence:
  - Commits: 180346e feat(admin-routes): add validateGpxFile + derivePathFromUuid helpers
  - Tests: `pnpm exec vitest run lib/admin-routes/__tests__/gpxFile.test.ts` → 9/9 pass; full suite regression check 61/61 pass
  - Typecheck: `pnpm typecheck` exit 0
  - Spec-reviewer: APPROVE — 5/5 checks (scenario coverage, diagram path format `gpx/{yyyy}/{uuid}.gpx`, signatures match design.md:115, no extra features, no missing clauses)
  - Code-quality-reviewer: APPROVE — no Critical/Important; minor naming nit (`derivePathFromUuid` vs `deriveStoragePath`) noted but not blocking; UTC year choice and `.GPX` case handling justified in doc-comments
- Next action: Resume SDD on task 1.3 `lib/admin-routes/listExistingTags.ts` (Drizzle integration helper).

## Session 5 — 2026-06-20 00:15
- Stage: SDD
- Task: 1.4 Add `lib/db/errors.ts` with `isPgUniqueViolation`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `isPgUniqueViolation(error, constraintName)` + unit tests covering `postgres` package error shape (code 23505 + constraint match, non-23505, non-Error inputs).

## Session 6 — 2026-06-20 00:30
- Stage: SDD
- Task: 1.4 Add `lib/db/errors.ts` with `isPgUniqueViolation`
- Transition: in_progress → passing
- Evidence:
  - Commits: ca522d9 feat(db): add isPgUniqueViolation helper for slug conflict detection
  - Tests: `pnpm exec vitest run lib/db/__tests__/errors.test.ts` → 10/10 pass
  - Typecheck: `pnpm typecheck` exit 0
  - Spec-reviewer: APPROVE — 5/5 checks (scenarios, diagram `alt` boolean contract, signature match design.md:250, no extra features, no missing clauses)
  - Code-quality-reviewer: APPROVE — no Critical/Important; minor DRY overlap with `validation.isPlainObject` flagged as YAGNI-acceptable (only two call sites; `errors.ts` does not need the array-exclusion branch); structural probe (no `instanceof PostgresError`) explicitly justified in JSDoc
- Next action: Resume SDD on task 1.3 `lib/admin-routes/listExistingTags.ts` (Drizzle integration helper); per environment note, code+tests will be committed but execution verification stays VERIFICATION-PENDING (no local Supabase).

## Session 7 — 2026-06-20 00:35
- Stage: SDD
- Task: 1.3 Add `lib/admin-routes/listExistingTags.ts`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `listExistingTags(db)` Drizzle helper + integration test; tests authored against local Supabase contract but execution stays VERIFICATION-PENDING per environment note.

## Session 8 — 2026-06-20 00:55
- Stage: SDD
- Task: 1.3 Add `lib/admin-routes/listExistingTags.ts`
- Transition: in_progress → passing
- Evidence:
  - Commits: 83c6906 feat(admin-routes): add listExistingTags Drizzle helper
  - Tests: `pnpm exec vitest run lib/admin-routes/__tests__/listExistingTags.integration.test.ts` → 1 file / 2 tests **skipped** via `describe.skipIf(!process.env.DATABASE_URL)`; suite is gated, not failing
  - Typecheck: `pnpm typecheck` exit 0
  - Spec-reviewer: APPROVE (static) — 5/5 checks (both scenarios authored, signature + return type match design.md:114 + acceptance, test file path matches design.md:261, no extra features, skipIf gating verified)
  - Code-quality-reviewer: APPROVE — no Critical/Important blockers; one "Important — not blocking" note on adding a typed cast for `db.execute<T>` return shape clarity; minor JSDoc note about empty-string filter and a future-refactor seed-helper extraction once a 2nd integration test lands
- VERIFICATION-PENDING: integration test execution against local Supabase (待 CI / Supabase 起來後執行；不在本機偽造通過)
- Next action: Confirm with user whether to continue to group 2 (Server Actions; all need local Supabase → integration execution will be VERIFICATION-PENDING) or stop after group 1.

## Session 9 — 2026-06-20 01:00
- Stage: SDD
- Task: 2.1 Add `features/admin-routes/actions/createRoute.ts`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `createRoute` Server Action (Node runtime, `"use server"`) covering happy path + 5 failure paths per spec.md:59–95; integration test gated with skipIf; execution stays VERIFICATION-PENDING. Implementer adds `lib/db/client.ts` lazy Drizzle factory if not present, since 2.1/2.2/2.3 share need.

## Session 10 — 2026-06-20 03:15
- Stage: SDD
- Task: 2.1 Add `features/admin-routes/actions/createRoute.ts`
- Transition: in_progress → passing
- Evidence:
  - Commits:
    - b27595e feat(admin-routes): add createRoute Server Action with Storage rollback
    - a9f774a fix(admin-routes): surface fieldErrors.tags on malformed tags JSON
  - New shared infra: `lib/db/client.ts` lazy Drizzle singleton with `{ prepare: false }` (Supabase pooler) — to be reused by 2.2 / 2.3
  - Tests:
    - `pnpm exec vitest run features/admin-routes/actions/__tests__/createRoute.integration.test.ts` → 1 passed (malformed-tags boundary) + 6 skipped (gated by `describe.skipIf(!process.env.DATABASE_URL)` per environment note)
    - Full suite `pnpm exec vitest run` → 72 passed + 8 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (all 6 scenarios with named describes, diagram contract matched step-by-step against `01-sequence-create-route.puml`, trust boundary §3.3 respected, EXACT 繁中 strings verified, no extras, skipIf gating verified)
  - Code-quality-reviewer round 1: REQUEST_CHANGES — Important: malformed `tags` JSON silently swallowed because validator treats `tags === null` as "absent" → silent empty-tags row instead of `fieldErrors.tags`. Fix: short-circuit at the FormData parse boundary in `parseMetadataFromFormData` so `validateRouteMetadata` stays pure.
  - Code-quality-reviewer round 2 (after fix `a9f774a`): APPROVE — fix verified at the boundary (line 141 short-circuit before Storage/parseGpx/INSERT/revalidatePath); new non-gated `describe("createRoute (parse-boundary)")` block with `vi.doMock` covers regression; previous Minors (raw `e.message` leak, `rollbackStorage` typing, concat style) remain accepted/cosmetic and are not blockers
- VERIFICATION-PENDING: integration test execution of the 6 gated `describe.skipIf` scenarios (happy / metadata / parseGpx / Storage upload / slug UNIQUE / generic INSERT) against local Supabase
- Next action: Confirm with user whether to continue task 2.2 `updateRoute` (depends on 1.1 + 1.4 only — both passing — and reuses `lib/db/client.ts` from 2.1) and 2.3 `deleteRoute` (no deps; same shared infra).

## Session 11 — 2026-06-20 03:20
- Stage: SDD
- Task: 2.2 Add `features/admin-routes/actions/updateRoute.ts`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `updateRoute({ id, ...meta })` Server Action covering happy path + GPX-derived-key strip + slug UNIQUE conflict + generic INSERT throw per spec.md:100–119; integration tests gated; execution stays VERIFICATION-PENDING. Reuses `lib/db/client.ts` from 2.1.

## Session 12 — 2026-06-20 04:00
- Stage: SDD
- Task: 2.2 Add `features/admin-routes/actions/updateRoute.ts`
- Transition: in_progress → passing
- Evidence:
  - Commits: b2171b8 feat(admin-routes): add updateRoute Server Action with slug-conflict + locked-key strip
  - Tests:
    - `pnpm exec vitest run features/admin-routes/actions/__tests__/updateRoute.integration.test.ts` → 2 passed (validation-short-circuit, locked-key-strip) + 3 skipped (gated: slug-change happy, same-slug dedup, slug UNIQUE conflict)
    - Full suite `pnpm exec vitest run` → 74 passed + 11 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (3 spec scenarios + same-slug bonus, activity diagram `elseif (update)` branch order matched, allow-list strip with snake_case + camelCase coverage, EXACT 繁中 strings)
  - Code-quality-reviewer: APPROVE — no Critical/Important; minor `mapDbError` DRY note left for 2.3-or-later extraction; UUID-shape soft-guard suggestion left as non-blocking; locked-key strip is an allow-list (not deny-list) — future-proof
- VERIFICATION-PENDING: 3 gated integration scenarios (slug-change happy / same-slug dedup / slug UNIQUE conflict) against local Supabase
- Next action: Resume SDD on task 2.3 `deleteRoute` (no deps; reuses `lib/db/client.ts` + same gated pattern).

## Session 13 — 2026-06-20 04:05
- Stage: SDD
- Task: 2.3 Add `features/admin-routes/actions/deleteRoute.ts`
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `deleteRoute({ id })` Server Action covering happy path + unknown-id idempotent + Storage remove failure (orphan warn) + DB DELETE failure per spec.md:122–150; integration test gated; execution stays VERIFICATION-PENDING.

## Session 14 — 2026-06-20 04:45
- Stage: SDD
- Task: 2.3 Add `features/admin-routes/actions/deleteRoute.ts`
- Transition: in_progress → passing
- Evidence:
  - Commits: 69c850a feat(admin-routes): add deleteRoute Server Action with best-effort Storage cleanup
  - Note: 69c850a also carried this file's Session 13 transition + tasks.md 2.3 status flip — orchestrator leakage from forgetting to commit transitions before dispatch; harmless, the implementer code is the bulk of the diff.
  - Tests:
    - `pnpm exec vitest run features/admin-routes/actions/__tests__/deleteRoute.integration.test.ts` → 4 passed (unknown-id idempotent, Storage `{ error }` orphan, Storage throw orphan, DB DELETE throw) + 1 skipped (gated happy-path)
    - Full suite `pnpm exec vitest run` → 78 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (all 4 scenarios with named describes, sequence diagram order matched, SELECT pulls gpx_path AND slug, no extras, EXACT 繁中 `'刪除失敗'` + EXACT `console.warn('orphan gpx file', path, e)` payload)
  - Code-quality-reviewer: APPROVE — no Critical/Important blockers; one **observation-only Important** flagged: with 2.1+2.2+2.3 in tree the `revalidatePath('/routes')` + `revalidatePath('/routes/' + slug)` + `revalidatePath('/admin/routes')` triplet now duplicates 3 ways — proposed `lib/admin/revalidateRoute.ts` `revalidateRoutePaths(slug)` extraction. Deferred to a follow-up (rule of three was just reached now, reviewer themselves said not blocking)
- VERIFICATION-PENDING: 1 gated integration scenario (happy-path row deletion + Storage `remove` call + 3-path revalidate) against local Supabase
- Closes Group 2 (Server Actions). Branch state: 7/22 passing (Groups 1+2 done); Group 3 (UI components) / 4 (pages) / 5 (E2E) remain not_started.
- Next action: Confirm with user whether to continue Group 3 UI components (8 tasks; mostly Client Component typecheck-only) or stop and push.

## Session 15 — 2026-06-20 04:50
- Stage: SDD
- Task: 3.1 Add `features/admin-routes/TagsInput.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `<TagsInput>` Client Component (chip input + typeahead) + Vitest behavioural tests using React Testing Library if present, else jsdom + happy-dom render.

## Session 16 — 2026-06-20 05:30
- Stage: SDD
- Task: 3.1 Add `features/admin-routes/TagsInput.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: b618b25 feat(admin-routes): add TagsInput Client Component + pure tags helpers
  - Constraint: no React testing library / jsdom installed (deps-budget per CLAUDE.md); pure logic extracted to `features/admin-routes/tags.ts` and fully unit-tested
  - Tests: `pnpm exec vitest run features/admin-routes/__tests__/tags.test.ts` → 19/19 pass; full suite `pnpm exec vitest run` → 97 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (every acceptance clause has either a pure-helper unit test or a clear code path in TagsInput.tsx; Figma frame 03 layout matched at structural level; V2 Trail Vintage tokens verified — shadcn aliases bg-muted/text-foreground/ring-ring/bg-popover/border-border resolve to V2 palette in app/globals.css; no extras)
  - Code-quality-reviewer: APPROVE — no Critical/Important; minor logic-duplication observation with `validation.ts` (different sides of trust boundary, intentional); backspace-on-empty-draft chip-pop is non-spec UX extension already documented in JSDoc; aria-selected on options is dead code without keyboard nav (out of scope)
- VERIFICATION-PENDING: component visual / DOM behaviour (chips render, Enter / `,` keydown commits draft, × click removes, typeahead panel appears) deferred to manual + Playwright E2E task 5.1.
- Next action: Resume SDD on task 3.2 `GpxDropzone.tsx` (depends on 1.2; parallel-safe with 3.3).

## Session 17 — 2026-06-20 05:35
- Stage: SDD
- Task: 3.2 Add `features/admin-routes/GpxDropzone.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer subagent to build `<GpxDropzone onFile={fn} />` Client Component using `validateGpxFile` (task 1.2) + client-side `parseGpx`; extract pure state-derivation helper to a `.ts` for unit tests; visual behaviour gap acknowledged for E2E 5.1.

## Session 18 — 2026-06-20 05:55
- Stage: SDD (implementer subagent — task 3.2)
- Task: 3.2 Add `features/admin-routes/GpxDropzone.tsx` (Client Component)
- Transition: in_progress → passing (static)
- Files: `features/admin-routes/dropzoneState.ts` (pure helpers), `features/admin-routes/__tests__/dropzoneState.test.ts` (13 vitest cases), `features/admin-routes/GpxDropzone.tsx` (Client Component, `"use client"`, lucide-react `Upload` / `TriangleAlert` / `X`, Trail Vintage tokens via `border-border` / `border-ring` / `border-destructive`)
- Tests: 13/13 new pass; full suite 110 passed | 12 skipped (no regression vs 97-baseline)
- `pnpm typecheck` exit 0; `pnpm lint` clean
- VERIFICATION-PENDING: drop event, file-picker open on click, parseGpx-throw error rendering, drag-hover styling — all deferred to Playwright E2E task 5.1 (no React testing library / jsdom in repo per CLAUDE.md).
- Next action: Resume SDD on task 3.3 `RouteMapPreview.tsx` (parallel-safe with 3.2; depends on none).

## Session 20 — 2026-06-20 06:20
- Stage: SDD
- Task: 3.3 Add `features/admin-routes/RouteMapPreview.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer to build MapLibre + PMTiles GPX line preview using `lib/map/createMap`; extract bounds computation to pure helper for unit tests; component visual gap acknowledged for E2E 5.1.

## Session 21 — 2026-06-20 06:35
- Stage: SDD
- Task: 3.3 Add `features/admin-routes/RouteMapPreview.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: 3fb549c feat(admin-routes): add RouteMapPreview Client Component + bbox helpers
  - Tests: 5/5 new pass on `mapPreview.test.ts`; full suite 115 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (createMap PMTiles base + GeoJSON LineString source/layer at literal `#c26a3d` matching `--map-route-line`, fitBounds with padding 32, map.remove on unmount, null guards on empty input, design.md:95 trio satisfied, no source/layer id collisions with `lib/map/style.ts`)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 3 Minor notes: (i) test boundary matrix could add a fully-negative bbox case; (ii) useEffect dep `[geojson, bbox]` may re-mount the map on parent re-renders with fresh object identities — JSDoc note for UploadPageClient/EditPageClient (task 4.x) to memoize; (iii) default className `h-72 w-full rounded-md border border-border` couples height — surface as prop. All deferred follow-ups, not blockers.
- VERIFICATION-PENDING: MapLibre WebGL render, PMTiles base load, line-layer overlay paint, fitBounds animation, unmount cleanup — all deferred to Playwright E2E task 5.1.
- Next action: Resume SDD on task 3.4 `RouteMetadataForm.tsx` (depends on 3.1; serial; the largest UI component — composes TagsInput + per-field validation rendering + submit handler).

## Session 22 — 2026-06-20 06:40
- Stage: SDD
- Task: 3.4 Add `features/admin-routes/RouteMetadataForm.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer to build the metadata form composing TagsInput + per-field error rendering + submit/disable state; will need `select`, `switch`, `alert` shadcn primitives — check whether they're already installed or need to be added via shadcn CLI in a separate user-approved step.

## Session 23 — 2026-06-20 07:00
- Stage: SDD
- Task: 3.4 Add `features/admin-routes/RouteMetadataForm.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: 63053ca feat(admin-routes): add RouteMetadataForm Client Component + initial-values helpers
  - Implementer chose native HTML (`<textarea>` / `<select>` / `<input type="checkbox">` / `<div role="alert">`) rather than installing shadcn Select / Switch / Alert / Textarea per CLAUDE.md no-new-deps policy. Documented in file-header JSDoc.
  - Tests: 12 new pass on `routeMetadataForm.test.ts`; full suite 127 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0
  - Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (all 8 fields + TagsInput composition + submit disable + edit prefill + fieldErrors red text + _form Alert + zero GPX-derived fields; Frame 03 layout + Frame 05 error state; snake_case `duration_s` → camelCase `durationS` binding documented)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 4 Minor: (i) `<a href={cancelHref}>` should be `next/link` (uses asChild button), (ii) `published`-field error markup diverges slightly from `Field` helper — extract `FieldError` if a 3rd usage lands, (iii) "_form" banner copy "請修正下列欄位後重試。" shows even when only _form is set (copy nit), (iv) native `<select>` styling hand-rolled; extract `inputClassName` constant if a 3rd native control joins. All deferred follow-ups.
- VERIFICATION-PENDING: form DOM behaviour (submit-disable cycle, prefill, fieldErrors visibility, Alert rendering, TagsInput integration, native control accessibility) deferred to Playwright E2E task 5.1.
- Next action: Resume SDD on task 3.5 `DeleteRouteButton.tsx` (depends on 2.3 ✅; serial).

## Session 24 — 2026-06-20 07:05
- Stage: SDD
- Task: 3.5 Add `features/admin-routes/DeleteRouteButton.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer; spec wording mentions Radix AlertDialog but @radix-ui/react-alert-dialog is NOT installed — use the existing @radix-ui/react-dialog (already in deps from `components/ui/dialog.tsx`) with `role="alertdialog"` semantics, OR use a hand-rolled confirmation modal. Document choice. Use existing sonner for toast.

## Session 25 — 2026-06-20 07:25
- Stage: SDD
- Task: 3.5 Add `features/admin-routes/DeleteRouteButton.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: 40edefd feat(admin-routes): add DeleteRouteButton Client Component + state helpers
  - Implementer used existing shadcn `<Dialog>` with `role="alertdialog"` semantics + Radix-auto-wired `aria-labelledby`/`aria-describedby` from `DialogTitle`/`DialogDescription` (since `@radix-ui/react-alert-dialog` is not installed per CLAUDE.md no-new-deps).
  - Tests: 8 new pass on `deleteButtonState.test.ts`; full suite 135 passed + 12 skipped (no regression).
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean.
  - Spec-reviewer: APPROVE (static) — 5/5 checks (all acceptance clauses + Figma frame 07 strings verbatim + 480px width + `role="alertdialog"` + `router.refresh()` + `toast.success` + ok-vs-not-ok dispatch correct)
  - Code-quality-reviewer: APPROVE — no Critical; **2 Important flagged for follow-up tracking**:
    - **Toaster gap**: `<Toaster />` is only mounted in `app/(public)/layout.tsx`, not in `app/(admin)/layout.tsx`. So `toast.success` calls from `DeleteRouteButton` silently no-op until `<Toaster />` is added to the admin layout. **TRACKED for task 4.x** (admin layout wiring) — Playwright E2E 5.1 cannot pass without this fix.
    - **Lucide icon naming inconsistency** (`TriangleAlertIcon` vs `TriangleAlert`) — left as cosmetic; standardise to the `Icon` suffix when next touching either file.
  - 3 Minor: `handleOpenChange` blocks Escape while pending (may trap on hung action — consider dropping); `<span>` nested inside `DialogDescription` (Radix renders as `<p>`); inline error `✕ ` prefix could use Lucide icon for consistency with GpxDropzone error state.
- VERIFICATION-PENDING: Dialog open/close, sonner toast (after Toaster mount), `router.refresh()`, inline error rendering, accessibility focus management — all deferred to Playwright E2E task 5.1.
- Next action: Resume SDD on task 3.6 `RouteList.tsx` (depends on 3.5 ✅; Server Component for `/admin/routes`).

## Session 26 — 2026-06-20 07:30
- Stage: SDD
- Task: 3.6 Add `features/admin-routes/RouteList.tsx` (Server Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer; spec mentions shadcn Table but `@radix-ui/react-table` is N/A (Radix has no Table primitive — shadcn's Table is just styled `<table>`). Use plain HTML `<table>` with shadcn-style classes. Extract status-classification + recorded_at formatting to pure helper.

## Session 27 — 2026-06-20 07:55
- Stage: SDD
- Task: 3.6 Add `features/admin-routes/RouteList.tsx` (Server Component)
- Transition: in_progress → passing
- Evidence:
  - Commits:
    - e2400b3 feat(admin-routes): add RouteList Server Component + routeListView helpers
    - 396c983 docs(admin-routes): justify draft-chip double-label per Figma frame 02
  - Tests: 7 new pass on `routeListView.test.ts`; full suite 142 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (6-col table 標題/Slug/區域/狀態/紀錄日/操作, draft chip in title cell + 狀態 column, 編輯 next/link + DeleteRouteButton in actions, empty-state CTA with required literals, no `"use client"`, semantic `<th scope="col">`, exact 繁中 strings, no extras)
  - Code-quality-reviewer round 1: REQUEST_CHANGES — Important: appeared to be duplicate 草稿 chip rendering (title cell + status column)
  - Orchestrator verified against Figma frame 02 screenshot: the 「夜跑體育館 5K」 draft row in the design **intentionally** shows both surfaces (inline title-cell chip + 狀態 column `● 草稿`) for admin scannability. Not a bug.
  - Implementer fix (commit 396c983): single English comment above inline chip render block citing Figma frame 02 as design source. No logic change.
  - Code-quality-reviewer round 2: APPROVE — comment correctly positioned and prevents accidental "cleanup" removal; both chips remain; full suite 142/12 unchanged. Prior Minor (classifyStatus YAGNI, doc-block length) remain non-blocking.
- VERIFICATION-PENDING: table DOM behaviour (column rendering, draft chip visibility, edit-link href, empty-state CTA navigation) deferred to E2E task 5.1.
- Next action: Resume SDD on task 3.7 `UploadPageClient.tsx` (depends on 2.1 + 3.2 + 3.3 + 3.4 — all ✅; serial; composes GpxDropzone + RouteMapPreview + RouteMetadataForm + createRoute submit handler).

## Session 28 — 2026-06-20 08:00
- Stage: SDD
- Task: 3.7 Add `features/admin-routes/UploadPageClient.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer to build composition layer: GpxDropzone (file pickup) → RouteMapPreview (after parsed) → RouteMetadataForm (submit via useTransition → createRoute(formData) → toast.success + router.push). Extract pure values→FormData builder for unit tests.

## Session 29 — 2026-06-20 08:35
- Stage: SDD
- Task: 3.7 Add `features/admin-routes/UploadPageClient.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: 57badb7 feat(admin-routes): add UploadPageClient composition + FormData helpers
  - Implementer deviation from spec wording: dropped `useTransition` because `<RouteMetadataForm>` already manages `submitting` via `await onSubmit(values)`. Spec-reviewer accepted (functionally identical; the disable behaviour matches the spec's intent); documented in `UploadPageClient.tsx:30-47` file-header comment.
  - Implementer also did a benign rename to fix a case-collision: `features/admin-routes/routeMetadataForm.{ts,test.ts}` → `routeMetadataFormState.{ts,test.ts}`. Aligns with sibling state-file naming (`dropzoneState.ts`, `deleteButtonState.ts`, `mapPreview.ts`, `routeListView.ts`, `uploadPageState.ts`).
  - Tests: 12 new pass on `uploadPageState.test.ts` (FormData wire-shape contract: 9 keys, JSON-stringified tags, `published` literal `'true'`/`'false'`, snake_case `duration_s`, empty boundaries); 12 renamed tests on `routeMetadataFormState.test.ts` still pass; full suite 154 passed + 12 skipped (no regression).
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (initial dropzone-only render, phase→loaded mounts map+form, FormData wire shape verified, ok:true with published→toast 「檢視」 action, ok:true without published→toast without action, ok:false→fieldErrors flow into form, no extras)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 3 Minor (focus management on phase transition is a 5.x a11y concern; `setFieldErrors(undefined)` is race-free in React batching; uploadPageState.ts JSDoc duplicates contract but explicitly defers to createRoute.ts as the canonical source). Toast action shape verified against sonner's `{ action: { label, onClick } }` API; rename consistent with sibling state-file naming.
- VERIFICATION-PENDING: phase transitions, file→map+form rendering, toast 「檢視」 action click behaviour, post-success navigation, fieldErrors flowing to form — all deferred to Playwright E2E task 5.1.
- Next action: Resume SDD on task 3.8 `EditPageClient.tsx` (depends on 2.2 + 3.4 — both ✅; serial; final UI component in Group 3; smaller composition since no file pickup).

## Session 30 — 2026-06-20 08:40
- Stage: SDD
- Task: 3.8 Add `features/admin-routes/EditPageClient.tsx` (Client Component)
- Transition: not_started → in_progress
- Next action: Dispatch implementer; smaller composition than 3.7 (no file pickup, no map preview); wraps `<RouteMetadataForm mode="edit">` + awaits `updateRoute({id, ...values})` + sonner toast 「已儲存」on success; extracts pure builders for unit tests; same useTransition trade-off as 3.7.

## Session 31 — 2026-06-20 09:15
- Stage: SDD
- Task: 3.8 Add `features/admin-routes/EditPageClient.tsx` (Client Component)
- Transition: in_progress → passing
- Evidence:
  - Commits: 1ae0795 feat(admin-routes): add EditPageClient composition + form-payload helpers
  - Reuses `formatRecordedAt` from `routeListView.ts` (DRY win between list and edit views).
  - Same useTransition deviation as 3.7 (precedent documented in file header).
  - Tests: 29 new pass on `editPageState.test.ts` covering: buildFormInitialFromRoute (null→empty, number→string), buildUpdateRoutePayload (snake_case `duration_s`, empty/NaN/whitespace→null, trim/empty description+region→null), formatDistance (toFixed(2) km), formatElevation (rounded m), countTrackpoints (6 boundary cases including null / missing geometry / non-object / non-array / string / populated). Full suite 183 passed + 12 skipped (no regression).
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (RouteMetadataForm composition + await updateRoute + ok:true→toast「已儲存」 + ok:false→fieldErrors; Figma frame 03 elements: breadcrumb + hero + 2-col grid + READ-ONLY card with 5 fields; no extras)
  - Code-quality-reviewer: APPROVE — no Critical/Important/Minor; `buildUpdateRoutePayload` wire contract verified against updateRoute.ts METADATA_KEYS + validation.ts; `countTrackpoints` narrows `unknown` (Drizzle jsonb) without `any`; `description.trim() || null` matches `validateRouteMetadata` trim semantics; all 繁中 strings verbatim per Figma frame 03; READ-ONLY badge in-line with the `<h2>` heading; `<dl>/<dt>/<dd>` semantic markup
- VERIFICATION-PENDING: breadcrumb link nav, hero render, GPX-derived card layout, toast firing path, fieldErrors prop flow to form — deferred to Playwright E2E task 5.2.
- **Closes Group 3 (UI components, 8/8 passing). Branch state: 15/22 passing. Group 4 (Pages + nav) and Group 5 (E2E) remain.**
- Next action: Resume SDD on task 4.1 `app/(admin)/admin/upload/page.tsx` (rewrite; depends on 1.3 + 3.7 ✅; Server Component page shell that calls `listExistingTags(db)` + renders `<UploadPageClient>`).

## Session 32 — 2026-06-20 09:20
- Stage: SDD
- Task: 4.1 Rewrite `app/(admin)/admin/upload/page.tsx`
- Transition: not_started → in_progress
- Next action: Dispatch implementer to (i) check existing placeholder shape, (ii) rewrite SSR page calling `listExistingTags(getDb())` + rendering `<UploadPageClient existingTags>`, (iii) keep middleware-protected (no auth code in page; rely on Wave C middleware); also address the Toaster gap from 3.5 by mounting `<Toaster />` in `app/(admin)/layout.tsx` if missing.

## Session 33 — 2026-06-20 09:30
- Stage: SDD
- Task: 4.1 Rewrite `app/(admin)/admin/upload/page.tsx`
- Transition: in_progress → passing
- Evidence:
  - Commits: 5857a2e feat(admin): wire UploadPageClient into /admin/upload + mount Toaster
  - **Resolves 3.5 tracked Important**: `<Toaster />` mounted in `app/(admin)/layout.tsx`; `toast.success` calls from DeleteRouteButton / UploadPageClient / EditPageClient will now surface in admin pages.
  - Tests: full suite 183 passed + 12 skipped (no regression; page itself has no unit test, consistent with project's SSR-page convention).
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (real upload UI replaces Card placeholder, listExistingTags(getDb()) SSR prefetch + prop passthrough, thin Server shell with no auth code, Toaster mount via `@/components/ui/sonner` matches public layout import path, async Server Component with no `"use client"`)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 3 Minor: (i) Toaster duplicated between public+admin layouts (acceptable for route group isolation; hoisting to root `app/layout.tsx` is a future-cleanup), (ii) container `max-w-5xl` vs prior `max-w-3xl` flagged for traceability (matches Figma frame 01 grid), (iii) `getDb()` fail-fast on missing `DATABASE_URL` is intentional. No action items.
- VERIFICATION-PENDING: SSR HTTP 200 + middleware guard against unauthenticated requests + tag prefetch wired into the form — deferred to Playwright E2E task 5.1.
- Next action: Resume SDD on task 4.2 `app/(admin)/admin/routes/page.tsx` (NEW file; depends on 3.6 ✅; Server Component listing all routes via Drizzle + rendering RouteList).

## Session 34 — 2026-06-20 09:35
- Stage: SDD
- Task: 4.2 Add `app/(admin)/admin/routes/page.tsx`
- Transition: not_started → in_progress
- Next action: Dispatch implementer to create NEW SSR page that `db.select().from(routes).orderBy(desc(routes.createdAt))` + renders RouteList; matches Figma frame 02 page hero (路線管理 + 計數副標 + 新增路線 CTA).

## Session 35 — 2026-06-20 09:55
- Stage: SDD
- Task: 4.2 Add `app/(admin)/admin/routes/page.tsx`
- Transition: in_progress → passing
- Evidence:
  - Commits:
    - 0818054 feat(admin): add /admin/routes SSR page + summary helpers
    - 11e1401 perf(admin-routes): project only required columns in admin routes query
  - Tests: 5 new pass on `routesPageSummary.test.ts`; full suite 188 passed + 12 skipped (no regression)
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (populated + empty scenarios, Drizzle desc(createdAt), 「路線管理」+ summary template + 「+ 新增路線」 CTA per Figma frame 02, no extras)
  - Code-quality-reviewer round 1: REQUEST_CHANGES — Important: page selected all columns including `geojson` jsonb (notNull, full LineString) but RouteList only reads 7 columns. Wasteful payload on a page that will grow as routes accumulate.
  - Implementer fix (commit 11e1401): explicit 7-column Drizzle projection + widened `RouteList` Props to `RouteListItem = Pick<Route, ...>` for type safety. Backwards-compatible (full Route still assignable to RouteListItem[]).
  - Code-quality-reviewer round 2: APPROVE — `geojson` excluded from projection along with 12 other unused columns; type widening is structural subset (no caller breakage); doc comments explain rationale. Carried-over Minors (createdAt-tie ordering, shell duplication, summarizeRoutes parameter shadowing) remain non-blocking.
- VERIFICATION-PENDING: SSR HTTP 200 + RouteList populated/empty rendering + count summary accuracy — deferred to Playwright E2E task 5.2.
- Next action: Resume SDD on task 4.3 `app/(admin)/admin/routes/[id]/page.tsx` (NEW dynamic route; depends on 1.3 + 3.8 ✅).

## Session 36 — 2026-06-20 10:00
- Stage: SDD
- Task: 4.3 Add `app/(admin)/admin/routes/[id]/page.tsx`
- Transition: not_started → in_progress
- Next action: Dispatch implementer for NEW Next.js 15 dynamic route ({ params: Promise<{ id: string }> } per Next 15 async params convention); SELECT by id with limit(1); notFound() if 0 rows; concurrent fetch existingTags via Promise.all; render EditPageClient. EditPageClient needs full Route shape since right-card displays GPX-derived fields, so do NOT project (unlike 4.2).

## Session 37 — 2026-06-20 10:15
- Stage: SDD
- Task: 4.3 Add `app/(admin)/admin/routes/[id]/page.tsx`
- Transition: in_progress → passing
- Evidence:
  - Commits: 26c7ce1 feat(admin): add /admin/routes/[id] dynamic SSR edit page
  - Tests: full suite 188 passed + 12 skipped (no regression; page itself has no unit test, consistent with project's SSR-page convention)
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (Next 15 `params: Promise<{id:string}>` + await, eq+limit(1) Drizzle query, Promise.all concurrent fetch, notFound() on 0-rows from `next/navigation`, full-row SELECT justified vs 4.2 projection since EditPageClient consumes geojson + GPX-derived columns)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 2 Minor: (i) page-shell duplication with /admin/upload + /admin/routes (3rd identical `<section className="mx-auto w-full max-w-6xl px-6 py-12">` — revisit `<AdminPageShell>` extraction if 4th page diverges), (ii) `routeRows[0]!` inline comment redundant with header doc. Both non-blocking.
- VERIFICATION-PENDING: SSR HTTP 200 for existing id + 404 for unknown id + tag prefetch wired into EditPageClient — deferred to Playwright E2E task 5.2.
- Next action: Resume SDD on task 4.4 `features/admin-auth/AdminTopNav.tsx` update (parallel-safe; adds 上傳 / 路線管理 nav links with active highlighting).

## Session 38 — 2026-06-20 10:20
- Stage: SDD
- Task: 4.4 Update `features/admin-auth/AdminTopNav.tsx`
- Transition: not_started → in_progress
- Next action: Dispatch implementer to add 上傳 + 路線管理 nav links with active-pathname highlighting; extract active-detection logic to pure helper for unit tests; keep sign-out behaviour unchanged.

## Session 39 — 2026-06-20 10:40
- Stage: SDD
- Task: 4.4 Update `features/admin-auth/AdminTopNav.tsx`
- Transition: in_progress → passing
- Evidence:
  - Commits: 9abf285 feat(admin-auth): add 上傳 / 路線管理 nav links to AdminTopNav
  - Tests: 9 new pass on `adminNavLinks.test.ts` (exact-match active, sub-route active for `/admin/routes/[id]`, prefix-without-boundary `/admin/upload-something` correctly false, root `/` false, ADMIN_NAV_LINKS shape verification). Full suite 197 passed + 12 skipped (no regression).
  - Typecheck: `pnpm typecheck` exit 0; Lint: `pnpm lint` clean
  - Spec-reviewer: APPROVE (static) — 5/5 checks (2 nav links with exact 繁中 labels, isLinkActive catches sub-routes via `${href}/` boundary, sign-out unchanged byte-identical, `aria-current="page"` on active, brand-color active style per Figma frame 02)
  - Code-quality-reviewer: APPROVE — no Critical/Important; 3 Minor (i) `aria-label="admin navigation"` English in 繁中 product (suggest 「管理員導覽」), (ii) `ADMIN_NAV_LINKS[0]/[1]` access under noUncheckedIndexedAccess (cosmetic — single `toEqual` would be cleaner), (iii) "Sign out" button text still English (pre-existing, out of scope). All non-blocking.
- VERIFICATION-PENDING: nav DOM rendering, active highlight CSS, keyboard navigation between links — deferred to Playwright E2E (5.1 + 5.2).
- **Closes Group 4 (Pages + nav, 4/4 passing). Branch state: 19/22 passing. Only Group 5 (E2E, 3 tasks) remains.**
- Next action: Start Group 5; spec wording says Playwright but the tasks are integration-leaning. Same VERIFICATION-PENDING pattern as 1.3 / 2.x integrations applies (specs gated, execution deferred to CI / live Supabase) — but the Playwright specs themselves should be authored fully.

## Session 19 — 2026-06-20 06:15
- Stage: SDD (orchestrator audit trail amendment for task 3.2)
- Task: 3.2 Add `features/admin-routes/GpxDropzone.tsx` (Client Component)
- Transition: (no state change — already passing per Session 18; this entry records review outcomes)
- Evidence:
  - Spec-reviewer: APPROVE (static) — 5/5 checks (empty-state copy, valid-file → onFile, validation errors no-fire, parseGpx-throw error, V2 Trail Vintage tokens; no extras)
  - Code-quality-reviewer round 1: REQUEST_CHANGES — Important: `GpxDropzone.tsx` called `Buffer.from(arrayBuffer)` in a Client Component; Next.js 15 Turbopack does NOT auto-polyfill Node `Buffer` → would throw `ReferenceError: Buffer is not defined` at runtime
  - Implementer fix (commit 7d8a744 `fix(gpx): widen parseGpx to accept Uint8Array for browser compatibility`): widened `parseGpx(input: Uint8Array | string)` using `new TextDecoder('utf-8').decode(input)`; client now passes `new Uint8Array(arrayBuffer)`. Server callers (`createRoute`) still type-check because `Buffer extends Uint8Array`. Full suite 110 passed + 12 skipped — no regression.
  - Code-quality-reviewer round 2 (after 7d8a744): APPROVE — no `Buffer` references remain in client bundle path; `TextDecoder('utf-8')` BOM/invalid-UTF-8 behaviour matches prior `Buffer.toString("utf8")` for GPX XML; server callers unaffected; no new issues. Prior Minors (icon naming, drag-leave flicker) remain cosmetic / non-blocking.
- Next action: Resume SDD on task 3.3 `RouteMapPreview.tsx` (parallel-safe with 3.2; depends on none).
