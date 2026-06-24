/**
 * Pure helpers for `<UploadPageClient>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without mounting React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM interaction is exercised end-to-end
 * by the admin upload Playwright spec.
 *
 * Spec:  openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *        §"RouteMetadataForm exposes the canonical metadata fields"
 *        §"createRoute Server Action persists metadata + GPX-derived columns"
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
 *   - `published`   → literal `'true'` or `'false'`
 *
 * Legacy keys (`tags` / `difficulty` / `duration_s` / `region`) were removed
 * by refactor-upload-metadata-fields / feat-gpx-driven-route-metadata. They
 * are NOT emitted here and the Action's validator silently ignores any older
 * client that still sends them.
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
  formData.append("published", values.published ? "true" : "false");
  return formData;
}

/**
 * Build the success-toast text fired after `createRoute` returns
 * `{ ok: true }`. Full-width 「」 brackets mirror the
 * `buildSuccessToast` pattern from `deleteButtonState.ts` so the admin
 * UI speaks with one voice across create/delete flows.
 */
export function buildSuccessToastText(title: string): string {
  return `已新增「${title}」`;
}
