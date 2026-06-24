import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  geometryMultiPolygon4326,
  geometryPoint4326,
  geometryPolygon4326,
} from "./postgis";

export const routes = pgTable(
  "routes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").unique().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    distanceM: integer("distance_m").notNull(),
    elevationGainM: integer("elevation_gain_m").notNull(),
    elevationProfile: jsonb("elevation_profile")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<Array<[number, number]>>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    locationName: text("location_name"),
    gpxPath: text("gpx_path").notNull(),
    geojson: jsonb("geojson").notNull(),
    bbox: geometryPolygon4326("bbox").notNull(),
    startPoint: geometryPoint4326("start_point").notNull(),
    coverImage: text("cover_image"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("routes_bbox_gist").using("gist", t.bbox),
    index("routes_start_point_gist").using("gist", t.startPoint),
    index("routes_recorded_at_desc").on(t.recordedAt.desc()),
  ],
);

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;

export const adminLevelEnum = pgEnum("admin_level", ["county", "township"]);

export const adminUnits = pgTable(
  "admin_units",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: text("code").unique().notNull(),
    level: adminLevelEnum("level").notNull(),
    name: text("name").notNull(),
    // Self-FK to admin_units(code); county rows have parent_code NULL.
    parentCode: text("parent_code"),
    geom: geometryMultiPolygon4326("geom").notNull(),
  },
  (t) => [
    index("admin_units_geom_gist").using("gist", t.geom),
    index("admin_units_level_idx").on(t.level),
  ],
);

export type AdminUnit = typeof adminUnits.$inferSelect;
export type NewAdminUnit = typeof adminUnits.$inferInsert;

export const routeAdminUnits = pgTable(
  "route_admin_units",
  {
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    adminUnitId: uuid("admin_unit_id")
      .notNull()
      .references(() => adminUnits.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.routeId, t.adminUnitId] }),
    index("route_admin_units_admin_unit_idx").on(t.adminUnitId),
  ],
);

export type RouteAdminUnit = typeof routeAdminUnits.$inferSelect;
export type NewRouteAdminUnit = typeof routeAdminUnits.$inferInsert;
