/**
 * Pure helpers for `<RouteList>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without rendering React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM behaviour (table layout, draft chip,
 * edit link routing, empty-state CTA) is exercised end-to-end by the
 * admin Playwright spec (task 5.1).
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/tasks.md §3.6
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md
 *        - `screenshots/02-routes-happy.png` — populated 3-row table
 *        - `screenshots/04-routes-empty.png` — dashed-border empty card
 */

/**
 * Format a `Date` as `YYYY-MM-DD` in UTC.
 *
 * Why UTC: the routes table is rendered on the server and on the
 * client (after `router.refresh()`); using the host timezone would
 * cause hydration mismatches AND drift between admin / public views
 * for runs recorded near midnight. The recorded_at column is a
 * `timestamptz` whose semantic anchor is the original GPX wall clock
 * (already normalised at ingest), so a stable UTC slice is the
 * deterministic choice for the table display.
 */
export function formatRecordedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Build the admin edit-page path for a route. Kept in a helper so the
 * routing convention (`/admin/routes/{id}`) lives in one place and is
 * trivially unit-tested for accidental refactors.
 */
export function buildEditPath(id: string): string {
  return `/admin/routes/${id}`;
}

/**
 * Discriminated union describing how a row's status chip should be
 * rendered. Exposed so the component can branch on `kind` once and
 * the test suite can cover the classification without inspecting JSX.
 */
export type RouteStatus = { kind: "published" } | { kind: "draft" };

/**
 * Classify the boolean `published` column into the chip variant the
 * `<RouteList>` row should render. Trivial today, but isolating the
 * mapping means future status flags (e.g. "scheduled", "archived")
 * can extend the union without touching the component DOM.
 */
export function classifyStatus(published: boolean): RouteStatus {
  return published ? { kind: "published" } : { kind: "draft" };
}
