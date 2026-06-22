/**
 * Normalise a raw Taiwan admin-unit FeatureCollection (from data.gov.tw
 * county / township GeoJSON) into the shape the seed migration consumes.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       "seed migration imports Taiwan admin units from GeoJSON"
 *
 * Trade-off note: the original design referenced 內政部 SHP source data
 * processed via a SHP parser. Adding a `shapefile` npm dep would violate
 * CLAUDE.md's no-new-deps rule, and `data.gov.tw` also publishes the same
 * boundary data as GeoJSON. The runbook
 * (`docs/runbooks/admin-units-refresh.md`) documents that contributors
 * download the GeoJSON variant and feed it to this function. If shp
 * processing is ever needed, the swap-in point is a separate
 * `parseShp(buffer)` upstream of this function.
 *
 * Field-mapping conventions (raw → normalised):
 *   COUNTYCODE / COUNTYNAME  → county  (parent_code = null)
 *   TOWNCODE / TOWNNAME + COUNTYCODE → township (parent_code = COUNTYCODE)
 *   Polygon geometry → MultiPolygon (single-element wrap)
 *   MultiPolygon geometry → passthrough
 */

export interface NormalisedFeature {
  type: "Feature";
  properties: {
    code: string;
    level: "county" | "township";
    name: string;
    parent_code: string | null;
  };
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][];
  };
}

export interface NormalisedFeatureCollection {
  type: "FeatureCollection";
  features: NormalisedFeature[];
}

type RawProperties = Record<string, unknown>;

interface RawFeature {
  type: "Feature";
  properties: RawProperties;
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

interface RawFeatureCollection {
  type: "FeatureCollection";
  features: RawFeature[];
}

function readString(props: RawProperties, key: string): string | undefined {
  const v = props[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asMultiPolygon(
  geom: RawFeature["geometry"],
): { type: "MultiPolygon"; coordinates: number[][][][] } {
  if (geom.type === "MultiPolygon") return geom;
  return { type: "MultiPolygon", coordinates: [geom.coordinates] };
}

function normaliseFeature(feature: RawFeature): NormalisedFeature {
  const townCode = readString(feature.properties, "TOWNCODE");
  const townName = readString(feature.properties, "TOWNNAME");
  const countyCode = readString(feature.properties, "COUNTYCODE");
  const countyName = readString(feature.properties, "COUNTYNAME");

  if (townCode && townName) {
    if (!countyCode) {
      throw new Error(
        `township ${townCode} (${townName}) missing parent COUNTYCODE`,
      );
    }
    return {
      type: "Feature",
      properties: {
        code: townCode,
        level: "township",
        name: townName,
        parent_code: countyCode,
      },
      geometry: asMultiPolygon(feature.geometry),
    };
  }

  if (!countyCode || !countyName) {
    throw new Error(
      `feature missing code (need either TOWNCODE+TOWNNAME or COUNTYCODE+COUNTYNAME): ${JSON.stringify(feature.properties)}`,
    );
  }

  return {
    type: "Feature",
    properties: {
      code: countyCode,
      level: "county",
      name: countyName,
      parent_code: null,
    },
    geometry: asMultiPolygon(feature.geometry),
  };
}

export function normalizeAdminUnits(
  raw: RawFeatureCollection,
): NormalisedFeatureCollection {
  return {
    type: "FeatureCollection",
    features: raw.features.map(normaliseFeature),
  };
}
