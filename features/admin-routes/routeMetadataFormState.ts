/**
 * Pure helpers for `<RouteMetadataForm>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without mounting React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM interaction is exercised end-to-end
 * by the admin upload Playwright spec (task 5.1).
 */

import type { RouteMetadataValues } from "./types";

/** Field defaults for the "create" path; also used as the merge base
 *  when `mode="edit"` so partial `initial` objects still produce a
 *  fully-typed `RouteMetadataValues`. */
const DEFAULT_VALUES: RouteMetadataValues = {
  title: "",
  slug: "",
  description: "",
  region: "",
  tags: [],
  difficulty: "easy",
  durationS: "",
  published: false,
};

/**
 * Build the initial form state.
 *
 * - `initial` is optional and may be partial; missing keys fall back
 *   to `DEFAULT_VALUES`.
 * - The returned object is always a fresh shallow copy so React
 *   `useState` never receives a shared reference.
 */
export function buildInitialValues(
  initial?: Partial<RouteMetadataValues>,
): RouteMetadataValues {
  return { ...DEFAULT_VALUES, ...(initial ?? {}) };
}

/**
 * Whether the `fieldErrors` map carries at least one entry — used by
 * the component to decide whether to render the `_form` Alert and the
 * per-field red text. `undefined` and `{}` both mean "no errors".
 */
export function hasAnyFieldError(
  fieldErrors?: Record<string, string>,
): boolean {
  if (!fieldErrors) return false;
  return Object.keys(fieldErrors).length > 0;
}
