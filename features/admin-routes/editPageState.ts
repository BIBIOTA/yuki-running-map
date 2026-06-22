/**
 * Pure helpers for `<EditPageClient>`.
 *
 * Spec:  openspec/changes/feat-gpx-driven-route-metadata/specs/admin-routes-crud/spec.md
 *        MODIFIED Requirement "/admin/routes/[id] renders the metadata edit form"
 *        MODIFIED Requirement "updateRoute Server Action mutates metadata only"
 * Tasks: openspec/changes/feat-gpx-driven-route-metadata/tasks.md §1.4
 *
 * Boundary translations performed here:
 *
 *   - `buildFormInitialFromRoute(route)` maps a Drizzle `Route` row →
 *     `Partial<RouteMetadataValues>` (the form-state shape).
 *     `description`: `null` → '' (form-state is non-null strings; the
 *     form round-trips empty strings).
 *   - `buildUpdateRoutePayload(id, values)` maps form-state →
 *     `updateRoute({ id, ...payload })` input shape:
 *     · `description`: trim; empty string → `null` (matches the
 *       validator's null/optional handling and keeps the eventual
 *       `routes.description` column NULL rather than '' for vacant
 *       submissions).
 *     · `tags` / `published` pass through verbatim.
 *
 * Legacy keys (`difficulty` / `duration_s` / `region`) were removed by
 * feat-gpx-driven-route-metadata; they are not part of either the row
 * mapping or the wire payload.
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
    tags: route.tags,
    published: route.published,
  };
}

/**
 * Build the structured payload passed to `updateRoute({ id, ...payload })`.
 * The accepted metadata keys are exactly title / slug / description / tags /
 * published — same allow-list `updateRoute` enforces server-side.
 */
export function buildUpdateRoutePayload(
  id: string,
  values: RouteMetadataValues,
): {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  tags: string[];
  published: boolean;
} {
  const description = values.description.trim();

  return {
    id,
    title: values.title,
    slug: values.slug,
    description: description.length === 0 ? null : description,
    tags: values.tags,
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
