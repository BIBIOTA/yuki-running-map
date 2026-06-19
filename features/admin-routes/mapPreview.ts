import type { BBox2D, LngLat } from "@/lib/gpx";

/**
 * Pure helpers used by `<RouteMapPreview>` to translate a GPX bbox into the
 * coordinate shapes MapLibre expects. Extracted so they can be unit-tested
 * in Vitest's node environment without booting `maplibre-gl` (the component
 * itself is covered by the admin upload Playwright spec, task 5.1).
 *
 * Spec / design: openspec/changes/feat-admin-gpx-upload/design.md:95
 *                openspec/changes/feat-admin-gpx-upload/tasks.md §3.3
 */

/**
 * Geometric centre of a GeoJSON-order bbox, returned as `[lng, lat]` so it
 * can be passed straight to MapLibre's `center` option.
 *
 * The result is the arithmetic mean of the two corner coordinates; it makes
 * no attempt to handle antimeridian-crossing bboxes (Yuki's routes are all
 * in Taiwan / nearby regions, so longitude wrap is out of scope).
 */
export function bboxCenter(bbox: BBox2D): LngLat {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/**
 * Convert a GeoJSON-order bbox into MapLibre's `fitBounds` tuple:
 * `[[southWestLng, southWestLat], [northEastLng, northEastLat]]`.
 *
 * Both points are `[lng, lat]` to match the rest of this codebase
 * (see `lib/gpx/types.ts` for the rationale).
 */
export function bboxToFitBoundsTuple(bbox: BBox2D): [LngLat, LngLat] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
