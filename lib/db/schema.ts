import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { geometryPoint4326, geometryPolygon4326 } from "./postgis";

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
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    locationName: text("location_name"),
    region: text("region"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    index("routes_tags_gin").using("gin", t.tags),
  ],
);

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;
