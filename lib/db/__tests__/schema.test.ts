import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schemaModule from "../schema";
import { routes } from "../schema";

describe("routes table schema", () => {
  const config = getTableConfig(routes);
  const columnByName = new Map(config.columns.map((c) => [c.name, c]));

  it("Schema file compiles with TypeScript strict", () => {
    expect(config.name).toBe("routes");

    const expected = [
      "id",
      "slug",
      "title",
      "description",
      "distance_m",
      "elevation_gain_m",
      "recorded_at",
      "location_name",
      "region",
      "tags",
      "gpx_path",
      "geojson",
      "bbox",
      "start_point",
      "cover_image",
      "published",
      "created_at",
      "updated_at",
    ];

    for (const name of expected) {
      expect(columnByName.has(name), `missing column: ${name}`).toBe(true);
    }

    expect(columnByName.get("slug")?.isUnique).toBe(true);
    expect(columnByName.get("slug")?.notNull).toBe(true);
    expect(columnByName.get("published")?.notNull).toBe(true);
  });

  it("routes table no longer exposes difficulty / duration_s columns", () => {
    // Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/admin-routes-crud/spec.md
    // Removed by migration 0004 (design.md §3.1) — Drizzle introspect must match.
    expect(columnByName.has("difficulty")).toBe(false);
    expect(columnByName.has("duration_s")).toBe(false);
  });

  it("schema module no longer exports difficultyEnum", () => {
    expect("difficultyEnum" in schemaModule).toBe(false);
  });

  it("PostGIS columns use customType helpers", () => {
    const bbox = columnByName.get("bbox");
    const startPoint = columnByName.get("start_point");

    expect(bbox?.notNull).toBe(true);
    expect(startPoint?.notNull).toBe(true);

    expect(bbox?.getSQLType()).toBe("geometry(Polygon, 4326)");
    expect(startPoint?.getSQLType()).toBe("geometry(Point, 4326)");
  });
});
