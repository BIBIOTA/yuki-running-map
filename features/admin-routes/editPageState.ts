/**
 * Pure helpers for `<EditPageClient>`.
 *
 * The component itself owns no business logic — all transformations
 * that can be unit-tested without mounting React live here, so the
 * vitest node runner (no React testing library; see CLAUDE.md re:
 * deps) can cover them. The DOM interaction is exercised end-to-end
 * by the admin edit Playwright spec (task 5.2).
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"/admin/routes/[id] renders the metadata edit form" (line 41)
 *        §"updateRoute Server Action" (allow-list contract)
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §3.8
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 03
 *        - `screenshots/03-routes-edit.png` — breadcrumb / hero / 2-col
 *          layout with the right column READ-ONLY GPX-derived card.
 *
 * Boundary translations performed here:
 *
 *   - `buildFormInitialFromRoute(route)` maps a Drizzle `Route` row →
 *     `Partial<RouteMetadataValues>` (the form-state shape).
 *     `description` / `region`: `null` → '' (form-state is non-null
 *     strings; `RouteMetadataForm` round-trips empty strings).
 *     `durationS`: `number | null` → string ('' when null).
 *   - `buildUpdateRoutePayload(id, values)` maps form-state →
 *     `updateRoute({ id, ...payload })` input shape:
 *     · `description` / `region`: trim; empty string → `null`
 *       (matches `validateRouteMetadata`'s null/optional handling and
 *       keeps the eventual `routes.description` column NULL rather
 *       than '' for vacant submissions).
 *     · `durationS` → `duration_s` (snake_case) as `number | null`.
 *       Empty string and NaN both fold to `null`; valid numeric
 *       strings parse via `Number()`. validateRouteMetadata enforces
 *       positive-integer semantics on the server.
 *     · `tags` / `published` / `difficulty` pass through verbatim.
 *
 * The shape we hand to `updateRoute` matches the allow-list keys in
 * `features/admin-routes/actions/updateRoute.ts :: METADATA_KEYS`.
 * Any extra keys (e.g. GPX-derived columns echoed back from the row)
 * are silently stripped by `stripToMetadataOnly`, so this helper only
 * needs to emit the metadata subset.
 */

import type { Route } from "@/lib/db/schema";

import type { RouteMetadataValues } from "./types";

/** Build form-state initial values from a Route row. */
export function buildFormInitialFromRoute(
  route: Route,
): Partial<RouteMetadataValues> {
  return {
    title: route.title,
    slug: route.slug,
    description: route.description ?? "",
    region: route.region ?? "",
    tags: route.tags,
    difficulty: route.difficulty,
    durationS: route.durationS === null ? "" : String(route.durationS),
    published: route.published,
  };
}

/**
 * Build the structured payload passed to
 * `updateRoute({ id, ...payload })`. Translates camelCase form-state
 * into the snake_case wire shape consumed by
 * `validateRouteMetadata` (which reads `duration_s`).
 */
export function buildUpdateRoutePayload(
  id: string,
  values: RouteMetadataValues,
): {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  region: string | null;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  duration_s: number | null;
  published: boolean;
} {
  const description = values.description.trim();
  const region = values.region.trim();
  const durationRaw = values.durationS.trim();
  const parsed = durationRaw === "" ? Number.NaN : Number(durationRaw);
  const duration_s = Number.isFinite(parsed) ? parsed : null;

  return {
    id,
    title: values.title,
    slug: values.slug,
    description: description.length === 0 ? null : description,
    region: region.length === 0 ? null : region,
    tags: values.tags,
    difficulty: values.difficulty,
    duration_s,
    published: values.published,
  };
}

/**
 * Format a distance in metres as `"{km} km"` with two decimal places.
 *
 * Used by the READ-ONLY GPX-derived card on the edit page (Figma
 * frame 03). The matching pattern on the public route page is owned
 * by `lib/format`; this helper is a local copy rather than an import
 * because the admin card uses a stricter two-decimal contract that
 * the public formatter does not guarantee. Keeping it here also lets
 * `editPageState.test.ts` cover the boundary cases without depending
 * on the public route format module.
 */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Format elevation gain metres as `"{m} m"` (integer). */
export function formatElevation(meters: number): string {
  return `${meters} m`;
}

/**
 * Count trackpoints in a `Route` `geojson` column safely.
 *
 * `routes.geojson` is typed as `jsonb` and selected back as `unknown`
 * — we cannot assume any shape at compile time. We narrow defensively:
 * the GPX ingest writes a `Feature<LineString>` with `geometry.coordinates`,
 * and any other shape returns `0` so the UI can fall back to '—' without
 * crashing.
 */
export function countTrackpoints(geojson: unknown): number {
  if (geojson === null || typeof geojson !== "object") return 0;
  const geometry = (geojson as { geometry?: unknown }).geometry;
  if (geometry === null || typeof geometry !== "object") return 0;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return 0;
  return coordinates.length;
}
