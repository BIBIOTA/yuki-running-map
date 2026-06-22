/**
 * Drizzle `customType` mappers for PostGIS `geometry` columns.
 *
 * Postgres receives the value via the wire protocol, so we serialise GeoJSON
 * `Polygon` / `Point` objects to **EWKT** (`SRID=4326;POLYGON(...)`) in
 * `toDriver`. PostGIS will then cast the EWKT text to the declared
 * `geometry(Polygon, 4326)` / `geometry(Point, 4326)` column type at INSERT
 * time. Without this, `db.insert(...).values({ bbox: { type:'Polygon', ... } })`
 * silently serialises as `[object Object]` and crashes the query with
 * `parse error - invalid geometry`.
 *
 * `fromDriver` accepts the WKB hex that PostGIS returns by default. For
 * callers that need GeoJSON back, project via `ST_AsGeoJSON(column)` in the
 * SELECT; the helper returns a `Polygon`-typed stub here so the strict
 * `data: Polygon` contract holds at compile time but the runtime value is the
 * raw WKB hex. The current admin pages in this capability never read these
 * columns for display (distance / elevation / trackpoint count come from
 * `geojson`), so the stub is acceptable; future readers should switch to
 * `ST_AsGeoJSON` projection or implement a WKB → GeoJSON parser here.
 */

import { customType } from "drizzle-orm/pg-core";
import type { MultiPolygon, Point, Polygon } from "geojson";

function polygonToEwkt(polygon: Polygon): string {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length === 0) {
    throw new Error("geometryPolygon4326.toDriver: empty polygon ring");
  }
  const points = ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `SRID=4326;POLYGON((${points}))`;
}

function pointToEwkt(point: Point): string {
  const [lng, lat] = point.coordinates;
  return `SRID=4326;POINT(${lng} ${lat})`;
}

function multiPolygonToEwkt(mp: MultiPolygon): string {
  const polygons = mp.coordinates.map((polygon) => {
    const ring = polygon[0];
    if (!ring || ring.length === 0) {
      throw new Error("geometryMultiPolygon4326.toDriver: empty polygon ring");
    }
    const points = ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
    return `((${points}))`;
  });
  return `SRID=4326;MULTIPOLYGON(${polygons.join(", ")})`;
}

export const geometryPolygon4326 = customType<{
  data: Polygon;
  driverData: string;
}>({
  dataType() {
    return "geometry(Polygon, 4326)";
  },
  toDriver(value: Polygon): string {
    return polygonToEwkt(value);
  },
});

export const geometryPoint4326 = customType<{
  data: Point;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value: Point): string {
    return pointToEwkt(value);
  },
});

export const geometryMultiPolygon4326 = customType<{
  data: MultiPolygon;
  driverData: string;
}>({
  dataType() {
    return "geometry(MultiPolygon, 4326)";
  },
  toDriver(value: MultiPolygon): string {
    return multiPolygonToEwkt(value);
  },
});
