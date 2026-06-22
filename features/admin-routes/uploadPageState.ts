/**
 * Pure helpers for `<UploadPageClient>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without mounting React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM interaction is exercised end-to-end
 * by the admin upload Playwright spec (task 5.1).
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"createRoute Server Action" — FormData wire shape
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §3.7
 */

import type { RouteMetadataValues } from "./types";

/**
 * Build the FormData payload `createRoute(formData)` expects.
 *
 * Wire-shape contract owned by
 * `features/admin-routes/actions/createRoute.ts :: parseMetadataFromFormData`:
 *
 *   - `gpxFile`     → the raw `File` (Blob-checked server-side)
 *   - `title`       → string
 *   - `slug`        → string
 *   - `description` → string (possibly empty)
 *   - `tags`        → JSON-stringified `string[]`
 *   - `published`   → literal `'true'` or `'false'`
 *
 * Legacy keys (`difficulty` / `duration_s` / `region`) were removed by
 * feat-gpx-driven-route-metadata. They are NOT emitted here and the
 * Action's validator silently ignores any older client that still sends
 * them (per spec admin-routes-crud "Legacy fields are silently ignored").
 *
 * `tags` is JSON-stringified rather than appended N times because the
 * Action parses it via `JSON.parse(tagsRaw)` and treats any deviation as
 * a wire-shape error (`{ fieldErrors: { tags: '標籤格式不正確' } }`).
 */
export function buildCreateRouteFormData(
  values: RouteMetadataValues,
  file: File,
): FormData {
  const formData = new FormData();
  formData.append("gpxFile", file);
  formData.append("title", values.title);
  formData.append("slug", values.slug);
  formData.append("description", values.description);
  formData.append("tags", JSON.stringify(values.tags));
  formData.append("published", values.published ? "true" : "false");
  return formData;
}

/**
 * Build the success-toast text fired after `createRoute` returns
 * `{ ok: true }`. Full-width 「」 brackets mirror the
 * `buildSuccessToast` pattern from `deleteButtonState.ts` so the admin
 * UI speaks with one voice across create/delete flows.
 *
 * 繁體中文 string is load-bearing — quoted verbatim by the spec
 * (`feat-admin-gpx-upload/specs/admin-routes-crud/spec.md`
 * §UploadPageClient Scenarios) and exercised by the admin upload
 * Playwright spec (task 5.1).
 */
export function buildSuccessToastText(title: string): string {
  return `已新增「${title}」`;
}
