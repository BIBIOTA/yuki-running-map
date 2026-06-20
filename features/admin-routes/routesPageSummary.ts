/**
 * Pure helpers for the `/admin/routes` page hero summary.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        openspec/changes/feat-admin-gpx-upload/tasks.md §4.2
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md
 *        - `screenshots/02-routes-happy.png` — page hero shows
 *          「路線管理」 + 副標 `N 條 · X 已發佈 · Y 草稿`.
 *
 * Why extract: the page itself is a thin async Server Component that
 * hits the database, so it cannot be unit-tested without a live
 * Postgres. By moving the count + label logic into pure functions we
 * get full unit coverage (see `__tests__/routesPageSummary.test.ts`)
 * without needing to spin up the DB.
 *
 * 繁體中文 strings are load-bearing — they are quoted verbatim by the
 * task acceptance criteria. Do NOT translate or paraphrase without
 * re-running spec validation.
 */

export type RoutesSummary = {
  total: number;
  published: number;
  draft: number;
};

/**
 * Count routes by published-state. Pure; takes only the boolean
 * `published` field so callers can pass minimal fixtures in tests.
 */
export function summarizeRoutes(routes: { published: boolean }[]): RoutesSummary {
  const total = routes.length;
  const published = routes.filter((r) => r.published).length;
  const draft = total - published;
  return { total, published, draft };
}

/**
 * Build the localised hero subtitle: `${total} 條 · ${published} 已發佈 · ${draft} 草稿`.
 */
export function buildSummaryText(summary: RoutesSummary): string {
  return `${summary.total} 條 · ${summary.published} 已發佈 · ${summary.draft} 草稿`;
}
