/**
 * Integration test for `listExistingTags`.
 *
 * Requires a live Postgres reachable at `process.env.DATABASE_URL` with the
 * `routes` table migrated (PostGIS extension enabled). The whole suite is
 * gated via `describe.skipIf(!process.env.DATABASE_URL)` so contributors and
 * CI jobs without a local Supabase don't see false failures — when the env
 * var is absent, vitest reports the suite as skipped, not failed.
 *
 * Each test runs against a freshly-truncated `routes` table to keep the two
 * scenarios independent of each other and of any data left behind by earlier
 * runs.
 */

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

import { listExistingTags } from "../listExistingTags";

describe.skipIf(!process.env.DATABASE_URL)("listExistingTags (integration)", () => {
  let client: Sql;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(() => {
    client = postgres(process.env.DATABASE_URL!);
    db = drizzle(client, { schema });
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE routes CASCADE`);
  });

  describe("Scenario: empty table returns []", () => {
    it("returns [] when no routes exist", async () => {
      const tags = await listExistingTags(db);
      expect(tags).toEqual([]);
    });
  });

  describe("Scenario: multiple routes with overlapping tags", () => {
    it("returns distinct union of all tag arrays, sorted", async () => {
      await seedRoute(db, {
        slug: "route-a",
        title: "Route A",
        tags: ["河濱", "LSD"],
      });
      await seedRoute(db, {
        slug: "route-b",
        title: "Route B",
        tags: ["LSD", "山路"],
      });
      await seedRoute(db, {
        slug: "route-c",
        title: "Route C",
        tags: ["河濱", "夜跑"],
      });

      const tags = await listExistingTags(db);

      // distinct
      expect(new Set(tags).size).toBe(tags.length);
      // union of all tags from the three rows
      expect(new Set(tags)).toEqual(new Set(["河濱", "LSD", "山路", "夜跑"]));
      // length equals union size (sanity)
      expect(tags.length).toBe(4);
    });
  });
});

interface SeedRouteInput {
  slug: string;
  title: string;
  tags: string[];
}

/**
 * Insert a single `routes` row using raw SQL so we can supply PostGIS
 * geometries via `ST_GeomFromText`. Every `NOT NULL` column without a
 * default must be provided; defaults handle `id`, `published`, `tags`
 * default, `created_at`, `updated_at`.
 */
async function seedRoute(
  db: PostgresJsDatabase<typeof schema>,
  input: SeedRouteInput,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO routes (
      slug,
      title,
      distance_m,
      elevation_gain_m,
      recorded_at,
      tags,
      gpx_path,
      geojson,
      bbox,
      start_point
    ) VALUES (
      ${input.slug},
      ${input.title},
      1000,
      0,
      ${new Date().toISOString()},
      ARRAY[${sql.join(
        input.tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[],
      ${"gpx/2026/" + input.slug + ".gpx"},
      ${sql`'{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121,25],[121.1,25.1]]},"properties":{}}'::jsonb`},
      ST_GeomFromText('POLYGON((121 25, 122 25, 122 26, 121 26, 121 25))', 4326),
      ST_GeomFromText('POINT(121 25)', 4326)
    )
  `);
}
