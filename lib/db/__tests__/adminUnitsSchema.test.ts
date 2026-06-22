import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { adminLevelEnum, adminUnits, routeAdminUnits } from "../schema";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirements: "admin_units stores Taiwan county and township polygons"
 *                     "route_admin_units join table associates routes with admin_units"
 */
describe("admin_units schema", () => {
  it("exports adminLevelEnum with values county / township", () => {
    expect(adminLevelEnum.enumName).toBe("admin_level");
    expect(adminLevelEnum.enumValues).toEqual(["county", "township"]);
  });

  it("declares the admin_units table with expected columns", () => {
    const config = getTableConfig(adminUnits);
    const columnByName = new Map(config.columns.map((c) => [c.name, c]));

    expect(config.name).toBe("admin_units");
    for (const name of ["id", "code", "level", "name", "parent_code", "geom"]) {
      expect(columnByName.has(name), `missing column: ${name}`).toBe(true);
    }
    expect(columnByName.get("code")?.isUnique).toBe(true);
    expect(columnByName.get("code")?.notNull).toBe(true);
    expect(columnByName.get("level")?.notNull).toBe(true);
    expect(columnByName.get("geom")?.notNull).toBe(true);
    expect(columnByName.get("geom")?.getSQLType()).toBe(
      "geometry(MultiPolygon, 4326)",
    );
  });
});

describe("route_admin_units schema", () => {
  it("declares the route_admin_units table with expected columns", () => {
    const config = getTableConfig(routeAdminUnits);
    const columnByName = new Map(config.columns.map((c) => [c.name, c]));

    expect(config.name).toBe("route_admin_units");
    expect(columnByName.has("route_id")).toBe(true);
    expect(columnByName.has("admin_unit_id")).toBe(true);
    expect(columnByName.get("route_id")?.notNull).toBe(true);
    expect(columnByName.get("admin_unit_id")?.notNull).toBe(true);
  });
});
