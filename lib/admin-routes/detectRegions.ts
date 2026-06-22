/**
 * Spatial-query helper used by `createRoute` to determine which Taiwan
 * admin_units a GPX line intersects.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "detectRegions performs the spatial query helper"
 *
 * Contract:
 *   - Input geometry is the SIMPLIFIED LineString from
 *     `parseGpx(buffer).geojson.geometry` — never the raw trackpoints.
 *   - Returns an array of `admin_units.id` UUIDs (possibly empty) for
 *     polygons that satisfy `ST_Intersects` against the input.
 *   - DB errors propagate so the caller's `db.transaction` can roll back.
 *
 * The query body intentionally lives in a `sql\`\`` template tag so the
 * helper is easy to read; the test asserts the literal SQL via the
 * Drizzle `SQL` object's stringification.
 */

import { sql, type SQL } from "drizzle-orm";

import { adminUnits } from "@/lib/db/schema";

interface LineStringGeometry {
  type: "LineString";
  coordinates: Array<[number, number]>;
}

interface Executor {
  execute(query: SQL): Promise<unknown[]>;
}

export async function detectRegions(
  tx: Executor,
  geometry: LineStringGeometry,
): Promise<string[]> {
  const geojsonText = JSON.stringify(geometry);
  const rows = (await tx.execute(
    sql`SELECT ${adminUnits.id} AS id FROM ${adminUnits} WHERE ST_Intersects(${adminUnits.geom}, ST_SetSRID(ST_GeomFromGeoJSON(${geojsonText}), 4326))`,
  )) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}
