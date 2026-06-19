/**
 * Pure helpers backing the `<TagsInput>` Client Component.
 *
 * Why split this out: `<TagsInput>` is a Client Component that depends on
 * React DOM. The current test environment is vitest + node (no jsdom, no
 * React testing library, and per project policy we may not add either
 * without explicit approval). Extracting the pure state transitions here
 * lets us cover the meaningful behaviour (add / dedupe / trim / remove /
 * typeahead filter) with fast unit tests, while the component itself is
 * exercised end-to-end by the admin upload Playwright spec (task 5.1).
 *
 * All comparisons are case-sensitive for `addTag` to match the validation
 * rule in `lib/admin-routes/validation.ts`, which also dedupes by exact
 * string match. `filterSuggestions` is case-insensitive because typeahead
 * UX expects fuzzy matching while typing.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §3.1
 */

const MAX_SUGGESTIONS = 5;

/**
 * Add a tag to `current`.
 *
 * - Trims whitespace.
 * - Empty (after trim) is a no-op and returns the SAME reference as `current`.
 * - Duplicates (after trim) are a no-op and return the SAME reference.
 * - Otherwise returns a new array `[...current, trimmedRaw]`.
 *
 * Returning the same reference on no-op lets callers cheaply detect "nothing
 * changed" with `next === current` and skip the `onChange` callback.
 */
export function addTag(current: string[], raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return current;
  if (current.includes(trimmed)) return current;
  return [...current, trimmed];
}

/**
 * Remove the tag at `index` from `current`.
 *
 * - Out-of-range indices (negative or `>= length`) are a no-op and return
 *   the SAME reference.
 * - Otherwise returns a new array without that index.
 */
export function removeTagAt(current: string[], index: number): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= current.length) {
    return current;
  }
  return [...current.slice(0, index), ...current.slice(index + 1)];
}

/**
 * Compute typeahead suggestions for the tag input.
 *
 * - Returns `[]` immediately when `input` is empty (after trim) — we do not
 *   want to spam the suggestion panel on focus.
 * - Case-insensitive substring match against `existingTags`.
 * - Excludes tags already present in `current` (case-sensitive, matches
 *   `addTag` dedup semantics).
 * - Caps the result at `MAX_SUGGESTIONS` (5) to keep the popover small.
 */
export function filterSuggestions(
  existingTags: string[],
  current: string[],
  input: string,
): string[] {
  const query = input.trim().toLowerCase();
  if (query.length === 0) return [];

  const selected = new Set(current);
  const out: string[] = [];
  for (const tag of existingTags) {
    if (selected.has(tag)) continue;
    if (!tag.toLowerCase().includes(query)) continue;
    out.push(tag);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}
