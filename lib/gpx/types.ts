import type { Feature, LineString } from "geojson";

/**
 * Coordinate tuple in GeoJSON order: `[longitude, latitude]`.
 *
 * GPX files store latitude before longitude (`<trkpt lat="…" lon="…">`),
 * but every consumer downstream of this module (PostGIS, MapLibre, GeoJSON)
 * expects `[lng, lat]`. We pay the swap cost once at the parser boundary
 * and never think about it again.
 */
export type LngLat = [number, number];

/**
 * Bounding box in GeoJSON 2D order: `[minLng, minLat, maxLng, maxLat]`.
 *
 * Matches the `bbox` member of GeoJSON `Feature` / `Geometry` (RFC 7946 §5.1).
 */
export type BBox2D = [number, number, number, number];

/**
 * Metadata extracted from a single GPX track. The `geojson` field is the
 * simplified line suitable for list-page thumbnails; `distanceM` and
 * `elevationGainM` are always computed over the full (unsimplified)
 * trackpoints so the numbers stay accurate.
 */
export interface GpxMetadata {
  /** Simplified `LineString` Feature in `[lng, lat]` order. */
  geojson: Feature<LineString>;
  /** Total ground distance in metres (Haversine over all trackpoints). */
  distanceM: number;
  /** Sum of positive elevation deltas in metres. `0` when no `<ele>` tags. */
  elevationGainM: number;
  /** `[minLng, minLat, maxLng, maxLat]` over all trackpoints. */
  bbox: BBox2D;
  /** First trackpoint as `[lng, lat]`. */
  startPoint: LngLat;
  /** Timestamp of the first `<trkpt><time>` element. */
  recordedAt: Date;
}
