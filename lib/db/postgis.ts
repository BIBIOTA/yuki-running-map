import { customType } from "drizzle-orm/pg-core";
import type { Point, Polygon } from "geojson";

export const geometryPolygon4326 = customType<{
  data: Polygon;
  driverData: string;
}>({
  dataType() {
    return "geometry(Polygon, 4326)";
  },
});

export const geometryPoint4326 = customType<{
  data: Point;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});
