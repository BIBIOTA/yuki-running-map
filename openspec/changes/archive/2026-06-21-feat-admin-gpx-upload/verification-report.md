---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

# Verification Report: feat-admin-gpx-upload

Date: 2026-06-20
Verifier: claude-opus-4-7 (spec-driven-dev:verification-before-completion)

## Summary

| Stage | Status | Notes |
|---|---|---|
| 1. Code (lint / typecheck / tests) | PASS | All commands exit 0; 197 passed + 12 skipped |
| 1.3 Scenario coverage (strict literal match) | **PARTIAL FAIL** | 22 scenarios literal-match; 12 unmatched. Categorised below — most are covered indirectly via abbreviated test names, by E2E execution (VERIFICATION-PENDING), or by the documented "no React testing library" deferral |
| 1.4 Manual smoke | PASS-with-caveat | `/` HTTP 200; `/admin/upload` + `/admin/routes` HTTP 307 redirect (middleware guard working as designed); authenticated admin UI requires real Supabase OAuth — VERIFICATION-PENDING |
| 2. Spec (openspec validate + progress + tasks) | PASS | All three sub-gates PASS |
| 3. Diagrams (sequence + sequence + activity) | PASS | 01 createRoute sequence matches code call order; 02 deleteRoute sequence matches; 03 activity Go per user manual review |
| 4.9 Design state visual conformance | DEFERRED | Requires authenticated admin browser session; same VERIFICATION-PENDING gate as e2e |
| 4.10 Component reuse | PASS | All `既有` shadcn primitives reused via `@/components/ui/*`; no duplication. Documented native-HTML deviation for 6 `shadcn 新增` primitives per CLAUDE.md no-new-deps |
| 5. Aggregation | this file | |

**Overall**: Spec + diagrams + most code checks PASS. The unmatched-scenario gap and the visual/auth-gated smoke + design checks fall into the documented **VERIFICATION-PENDING** pattern (no local Supabase / OAuth credentials in this environment) — same constraint that gated tasks 1.3 / 2.1–2.3 / 5.1–5.3 throughout the SDD pipeline.

This is **NOT** a clean pass per the strict hard-gate; the user should review the categorised gaps below and decide whether to:

- (A) Treat it as ready for `openspec archive` (accept the documented VERIFICATION-PENDING items as known follow-up work for the next environment with Supabase + admin user wired)
- (B) Wire up local Supabase + admin user and re-run verification to convert PENDING → PASS
- (C) Tighten the scenario / test name traceability (rename tests to match spec literals) before archiving

## Code Evidence

```
$ pnpm lint
$ eslint .
(exit 0, no output)

$ pnpm typecheck
$ tsc --noEmit
(exit 0, no output)

$ pnpm exec vitest run
 RUN  v4.1.8 /Users/bibiota/Documents/projects/run-map

 Test Files  24 passed | 1 skipped (25)
      Tests  197 passed | 12 skipped (209)
   Start at  10:32:48
   Duration  1.24s
```

## Smoke Evidence

```
$ curl http://localhost:3100/                  → HTTP 200 (35031 bytes)
$ curl http://localhost:3100/admin/upload      → HTTP 307 (redirect to /admin/login; middleware guard ✅)
$ curl http://localhost:3100/admin/routes      → HTTP 307 (redirect to /admin/login; middleware guard ✅)
```

Acceptance criterion "未登入或非 admin 被 middleware 擋" verified for 4.1, 4.2, 4.3 via 307 redirects. Authenticated state requires real Supabase OAuth and is in VERIFICATION-PENDING.

## Scenario Coverage — Unmatched Breakdown

The Stage 1.3 strict literal match flagged 12 unmatched scenarios. Categorised by reason:

### Category A: Covered with different test name (naming drift) — recommend test-name normalisation OR spec-text update

| Spec scenario | Actual test name | File |
|---|---|---|
| Happy path updates metadata and revalidates both slug paths | `Scenario: Happy path with slug change revalidates both slug paths` | `updateRoute.integration.test.ts:238` |
| Happy path removes row then Storage object | `Scenario: Happy path deletes row, calls Storage remove with gpx_path, revalidates 3 paths` | `deleteRoute.integration.test.ts:330` |
| Unknown id returns ok (idempotent) | covered by `Scenario: Unknown id returns ok without DB DELETE or Storage remove (idempotent)` | `deleteRoute.integration.test.ts` |
| Storage remove failure is logged but does not fail the Action | covered by 2 tests: `Scenario: Storage remove returns { error } — logs orphan, returns ok` + `Scenario: Storage remove THROWS — logs orphan, returns ok` | `deleteRoute.integration.test.ts:154, 211` |
| DB DELETE failure returns explicit error | covered (different name) | `deleteRoute.integration.test.ts` |

### Category B: Page-level scenarios — covered by Playwright E2E (VERIFICATION-PENDING execution)

| Spec scenario | E2E spec file |
|---|---|
| Authenticated admin sees the real upload UI | `e2e/admin-login-flow.spec.ts` (renamed test; asserts dropzone copy) + `e2e/admin-upload.spec.ts` |
| Existing tags are prefetched | indirectly covered by `e2e/admin-upload.spec.ts` (tag typeahead) |
| Admin sees populated route list | `e2e/admin-route-edit.spec.ts` (navigates `/admin/routes`) |
| Admin sees empty state when no routes exist | `routesPageSummary.test.ts` covers `summarizeRoutes([]) → all-zero`, but the full empty-state DOM render is in `RouteList.tsx` — no dedicated E2E case |
| Admin opens edit page for existing route | `e2e/admin-route-edit.spec.ts` |
| Edit page for unknown id returns 404 | **not directly tested** — relies on Next.js `notFound()` framework behaviour |
| Authenticated admin sees the placeholder | **obsolete** — this scenario was for the OLD `Coming soon` state, which the change replaces. Should be **REMOVED** from spec on the next iteration. |

### Category C: Visual UI scenarios — deferred per CLAUDE.md no-React-testing-library constraint

| Spec scenario | Covered (deferred to) |
|---|---|
| Empty state on initial mount (GpxDropzone) | E2E 5.1 (dropzone copy assertion) |
| Loaded state after valid drop | E2E 5.1 (map preview mount assertion) |
| Error state for non-gpx file | unit `dropzoneState.test.ts` covers the pure state branch; DOM assertion deferred |
| Error state for oversized file | same |
| Active link reflects current pathname | unit `adminNavLinks.test.ts` covers `isLinkActive`; DOM highlighting deferred |
| Active link switches on /admin/routes | same |
| Clicking delete opens the confirmation dialog | E2E 5.3 |
| Cancel closes the dialog without calling the Action | **not covered** — neither unit nor E2E exercises the Cancel path |
| Confirm triggers the Action and shows a toast on success | E2E 5.3 |

### Category D: E2E meta-scenarios

| Spec scenario | Status |
|---|---|
| admin-upload e2e exercises the real upload flow | Spec exists at `e2e/admin-upload.spec.ts`; execution VERIFICATION-PENDING |
| admin-route-edit e2e edits and persists metadata | Spec exists at `e2e/admin-route-edit.spec.ts`; execution VERIFICATION-PENDING |
| admin-route-delete e2e confirms and verifies deletion | Spec exists at `e2e/admin-route-delete.spec.ts`; execution VERIFICATION-PENDING |

## Diagram Verification

| File | Type | Status | Notes |
|---|---|---|---|
| `01-sequence-create-route.puml` | Sequence | PASS | createRoute.ts call order matches: validateRouteMetadata @ 144 → parseGpx @ 163 → randomUUID + derivePathFromUuid @ 172-173 → storage.upload @ 180 → db.insert @ 205 → isPgUniqueViolation in catch @ 258 → storage.remove rollback @ 292 → revalidatePath × 3 @ 273-275 |
| `02-sequence-delete-route.puml` | Sequence | PASS | deleteRoute.ts call order matches: select gpxPath+slug @ 63 → db.delete @ 77 → storage.remove (best-effort) → revalidatePath × 3 @ 99-101 |
| `03-activity-action-result-handling.puml` | Activity | PASS (user manual review: Go) | `alt` branches verified during 2.1/2.2/2.3 reviewer cycles: slug UNIQUE → fieldErrors.slug; other throws → _form + console.error; delete 0-rows → ok; Storage remove fail → orphan warn |

## Design Verification

### Per-state visual conformance (4.9)

| Frame | Figma node | Status | Notes |
|---|---|---|---|
| 01 /admin/upload (happy) | `58:3` | DEFERRED | Admin auth-gated; 307 redirect without OAuth credentials |
| 02 /admin/routes (happy 3 rows) | `59:2` | DEFERRED | Same; covered by E2E 5.2 visual flow |
| 03 /admin/routes/[id] (edit) | `60:2` | DEFERRED | Same; covered by E2E 5.2 |
| 04 /admin/routes (empty state) | `61:2` | DEFERRED | Same; covered by RouteList unit summary test |
| 05 /admin/upload (error) | `61:18` | DEFERRED | Requires triggering a server error path against authenticated session |
| 06 Dropzone states (composite) | `62:2` | DEFERRED | Covered by `dropzoneState.test.ts` pure logic + E2E 5.1 happy assertions |
| 07 Confirm delete dialog overlay | `62:83` | DEFERRED | Covered by E2E 5.3 click flow |

All 7 visual diffs are blocked by the same environment constraint (no local Supabase + OAuth) as the Playwright execution gate. Visual verification will run alongside Playwright execution in the next environment with secrets wired.

### Component reuse (4.10) — PASS

All `既有` (existing) components per `designs/figma.md:42–55` are imported from canonical paths, no duplicates:

| Component | Import path | Consumers |
|---|---|---|
| `Card` | `@/components/ui/card` | reused (e.g. admin login page) — not re-built for this change |
| `Input` | `@/components/ui/input` | `RouteMetadataForm`, `TagsInput` |
| `Button` | `@/components/ui/button` | `RouteMetadataForm`, `RouteList`, `DeleteRouteButton`, page shells |
| `Dialog` | `@/components/ui/dialog` | `DeleteRouteButton` (with `role="alertdialog"` override) |
| `Toaster` / `toast` | `@/components/ui/sonner` + `sonner` | Mounted in admin layout; `toast.success` in 3 client components |
| `AdminTopNav` | `@/features/admin-auth/AdminTopNav` | layout — modified, not re-built |
| `createMap` / PMTiles base | `@/lib/map/createMap` | `RouteMapPreview` |

**Documented deviation (not duplication)**: figma.md §Shared components used (line 47–52) lists 6 primitives as `shadcn 新增`:
- `select.tsx`, `table.tsx`, `badge.tsx`, `switch.tsx`, `alert.tsx`, `alert-dialog.tsx`

The implementer substituted native HTML controls per CLAUDE.md "Do not introduce new dependencies without first asking":
- Select → native `<select>` in `RouteMetadataForm.tsx`
- Table → native `<table>` in `RouteList.tsx`
- Badge → inline `<span>` chip in `RouteList.tsx`
- Switch → native `<input type="checkbox">` in `RouteMetadataForm.tsx`
- Alert → `<div role="alert">` in `RouteMetadataForm.tsx` and `DeleteRouteButton.tsx`
- AlertDialog → existing `Dialog` with `role="alertdialog"` override in `DeleteRouteButton.tsx`

This is a Figma-vs-implementation choice mismatch, not a duplication. Visual conformance against the Figma frames is in scope for the deferred visual check (4.9).

## Next Actions

Routing the user to choose how to close the verification:

### Option A — Treat as ready for archive (acknowledge VERIFICATION-PENDING)

If the documented gaps are acceptable as known follow-up work:

1. Optionally update **spec scenario wording** to match actual test names (Category A) and **remove the obsolete `Authenticated admin sees the placeholder` scenario** (Category B obsolescence).
2. Run `openspec archive feat-admin-gpx-upload` to archive the change.
3. Schedule a follow-up to run Playwright + visual diff in an environment with Supabase + OAuth credentials.

### Option B — Convert PENDING → PASS in this environment

If local Supabase + OAuth credentials can be wired:

1. Populate `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_GITHUB_USERNAME`, `DATABASE_URL` against a real Supabase project.
2. Sign in via GitHub OAuth once on the running app so the admin user exists in `auth.users`.
3. Run `pnpm db:migrate` to apply schema.
4. Re-run `pnpm exec vitest run` (gated integration tests should now actually execute, not skip).
5. Run `pnpm test:e2e` to execute the 3 Playwright admin specs.
6. Capture before/after screenshots of each Figma frame and visually diff.
7. Re-invoke `spec-driven-dev:verification-before-completion` to record the now-PASS results.

### Option C — Tighten test-name traceability

1. Rename tests so their `describe(...)` literal matches the spec scenario name exactly (Category A items). This shifts Stage 1.3 strict check to PASS.
2. Decide on coverage strategy for the `Cancel closes the dialog without calling the Action` scenario (currently not covered by unit or E2E) — either add a unit test for the dialog open-cancel sequence, or extend E2E 5.3 with a cancel-path test.
3. Re-run verification.

## Open Follow-ups (from SDD reviewer cycles, deferred during pipeline)

1. **`seedRoute` duplication** between `e2e/helpers/seed.ts` (postgres raw SQL) and `lib/admin-routes/__tests__/listExistingTags.integration.test.ts` (drizzle template). Extract to a shared `lib/db/test-utils` once a 3rd caller lands. (Flagged in 5.2 review.)
2. **`revalidatePath` triplet 3-way DRY** — 2.1 / 2.2 / 2.3 each call `revalidatePath('/routes') + '/routes/' + slug + '/admin/routes'`. Extract to `lib/admin/revalidateRoute.ts` `revalidateRoutePaths(slug)` as a future cleanup. (Flagged in 2.3 review.)
3. **Page-shell duplication** — `/admin/upload`, `/admin/routes`, `/admin/routes/[id]` all hand-roll `<section className="mx-auto w-full max-w-Npx px-6 py-12">`. Extract `<AdminPageShell>` if a 4th admin page diverges. (Flagged in 4.3 review.)
4. **`PLAYWRIGHT_FORCE_ASYNC_LOADER=1`** workaround in `package.json` `test:e2e` script — documented only in commit body; add a doc-runbook note. (Flagged in 5.1 review.)
5. **AdminTopNav `aria-label="admin navigation"`** is English in a 繁中 product — consider 「管理員導覽」. (Flagged in 4.4 review.)
6. **Task 5.1 spec/UI mismatch** — acceptance text says `預期看到 map preview 容器與 metadata 卡片內距離 / 爬升等數字` but UploadPageClient (3.7) does not render distance/elevation. Either trim the acceptance text or add a metadata-card block to UploadPageClient.
