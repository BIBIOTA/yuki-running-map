import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { difficultyEnum, routes } from "../schema";

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
      "duration_s",
      "recorded_at",
      "location_name",
      "region",
      "tags",
      "difficulty",
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

  it("PostGIS columns use customType helpers", () => {
    const bbox = columnByName.get("bbox");
    const startPoint = columnByName.get("start_point");

    expect(bbox?.notNull).toBe(true);
    expect(startPoint?.notNull).toBe(true);

    expect(bbox?.getSQLType()).toBe("geometry(Polygon, 4326)");
    expect(startPoint?.getSQLType()).toBe("geometry(Point, 4326)");

    expect(difficultyEnum.enumName).toBe("difficulty");
    expect(difficultyEnum.enumValues).toEqual(["easy", "medium", "hard"]);
  });
});
