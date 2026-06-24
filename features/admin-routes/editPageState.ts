/**
 * Pure helpers for `<EditPageClient>`.
 *
 * Spec:  openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *        MODIFIED Requirement "/admin/routes/[id] renders the metadata edit form"
 *        MODIFIED Requirement "updateRoute Server Action updates allow-listed metadata fields"
 *
 * Boundary translations performed here:
 *
 *   - `buildFormInitialFromRoute(route)` maps a Drizzle `Route` row →
 *     `Partial<RouteMetadataValues>` (the form-state shape).
 *     `description`: `null` → '' (form-state is non-null strings; the
 *     form round-trips empty strings).
 *   - `buildUpdateRoutePayload(id, values)` maps form-state →
 *     `updateRoute({ id, ...payload })` input shape:
 *     · `description`: trim; empty string → `null`.
 *     · `published` passes through verbatim.
 *
 * Legacy keys (`tags` / `difficulty` / `duration_s` / `region`) were
 * removed by refactor-upload-metadata-fields / feat-gpx-driven-route-metadata;
 * they are not part of either the row mapping or the wire payload.
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
    published: route.published,
  };
}

/**
 * Build the structured payload passed to `updateRoute({ id, ...payload })`.
 * The accepted metadata keys are exactly title / slug / description /
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
  published: boolean;
} {
  const description = values.description.trim();

  return {
    id,
    title: values.title,
    slug: values.slug,
    description: description.length === 0 ? null : description,
    published: values.published,
  };
}

/**
 * Format a distance in metres as `"{km} km"` with two decimal places.
 */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Format elevation gain metres as `"{m} m"` (integer). */
export function formatElevation(meters: number): string {
  return `${meters} m`;
}

/**
 * Count trackpoints in a `Route` `geojson` column safely. Returns 0 for
 * any unexpected shape so the UI can fall back to '—' without crashing.
 */
export function countTrackpoints(geojson: unknown): number {
  if (geojson === null || typeof geojson !== "object") return 0;
  const geometry = (geojson as { geometry?: unknown }).geometry;
  if (geometry === null || typeof geometry !== "object") return 0;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return 0;
  return coordinates.length;
}
