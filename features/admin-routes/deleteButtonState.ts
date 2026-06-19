/**
 * Pure helpers for `<DeleteRouteButton>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without mounting React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM interaction is exercised end-to-end
 * by the admin delete Playwright spec (task 5.1).
 *
 * 繁體中文 strings are load-bearing — they are quoted verbatim by the
 * spec (openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 * §"<DeleteRouteButton>" + Scenarios) and by Figma frame 07
 * (openspec/changes/feat-admin-gpx-upload/designs/screenshots/07-delete-dialog.png).
 * Do NOT translate or paraphrase without re-running spec validation.
 */

/**
 * Build the confirmation body text shown inside the AlertDialog.
 *
 * - When `gpxPath` is provided, the storage path is surfaced so the
 *   admin can audit which object will be removed (Figma frame 07
 *   shows this exact pattern).
 * - When `gpxPath` is omitted (Server Action-only callers, tests, or
 *   rows whose path was never persisted), we fall back to a shorter
 *   sentence that still mentions the GPX cleanup.
 * - `title` is interpolated as-is — callers SHOULD pass the real
 *   route title; the helper does not validate emptiness so the UI
 *   remains predictable for callers that want to render an empty
 *   placeholder (e.g. skeleton state).
 */
export function buildConfirmBody(title: string, gpxPath?: string): string {
  if (gpxPath) {
    return `將永久刪除「${title}」，含 GPX 原檔（${gpxPath}）。`;
  }
  return `將永久刪除「${title}」（含 GPX 原檔）。`;
}

/**
 * Build the success-toast message fired after `deleteRoute` returns
 * `{ ok: true }`. The full-width brackets are intentional and match
 * the Figma frame 07 text-style guide.
 */
export function buildSuccessToast(title: string): string {
  return `已刪除「${title}」`;
}
