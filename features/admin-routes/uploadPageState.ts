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
 * The wire-shape contract is owned by
 * `features/admin-routes/actions/createRoute.ts` :: `parseMetadataFromFormData`:
 *
 *   - `gpxFile`     → the raw `File` (Blob-checked server-side)
 *   - `title`       → string
 *   - `slug`        → string
 *   - `description` → string (possibly empty)
 *   - `region`      → string (possibly empty)
 *   - `tags`        → JSON-stringified `string[]`
 *   - `difficulty`  → `'easy' | 'medium' | 'hard'`
 *   - `duration_s`  → numeric string (snake_case key; the form state uses
 *                     camelCase `durationS` — this helper does the rename)
 *   - `published`   → literal `'true'` or `'false'`
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
  formData.append("region", values.region);
  formData.append("tags", JSON.stringify(values.tags));
  formData.append("difficulty", values.difficulty);
  // snake_case key intentional — matches the Action's `formData.get('duration_s')`.
  formData.append("duration_s", values.durationS);
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
