/**
 * Integration tests for the `updateRoute` Server Action.
 *
 * Requires a live Postgres at `process.env.DATABASE_URL` for the gated suite
 * (`describe.skipIf(!process.env.DATABASE_URL)`). When `DATABASE_URL` is
 * absent, vitest reports the suite as **skipped**, not failed. CI/contributors
 * without a local Supabase therefore see no false failures.
 *
 * Coverage split (intentional, documented for reviewers):
 *
 *   - The three acceptance scenarios per task 2.2 — happy path with slug
 *     change, happy path with same slug (revalidatePath de-dup), and slug
 *     UNIQUE conflict — run against a REAL Postgres so we verify wire-level
 *     behaviour: actual row updates, the actual `routes_slug_unique`
 *     constraint hit, the actual `updated_at` mutation.
 *   - The locked-key-strip and validation-failure-short-circuit scenarios use
 *     `vi.doMock(...)` + `vi.resetModules()` to inject controllable doubles.
 *     Mocking is the cleanest way to deterministically observe "the values
 *     handed to `db.update().set(...)` did NOT include any of the nine
 *     GPX-derived keys" and "no DB calls at all" without polluting the
 *     database.
 *
 * `next/cache` is mocked at module level (the Server Action calls
 * `revalidatePath` which has no meaning outside a Next.js request context).
 */

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { revalidatePath } from "next/cache";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Sample bbox/start_point GeoJSON used when seeding integration rows; values
// must satisfy the `geometryPolygon4326` / `geometryPoint4326` customTypes.
const SEED_BBOX = {
  type: "Polygon" as const,
  coordinates: [
    [
      [121.44, 25.17],
      [121.5, 25.17],
      [121.5, 25.18],
      [121.44, 25.18],
      [121.44, 25.17],
    ],
  ],
};
const SEED_START = {
  type: "Point" as const,
  coordinates: [121.44, 25.17],
};
const SEED_GEOJSON = {
  type: "LineString" as const,
  coordinates: [
    [121.44, 25.17],
    [121.45, 25.175],
  ],
};

interface SeedOverrides {
  slug?: string;
  title?: string;
  published?: boolean;
}

async function seedRoute(
  db: PostgresJsDatabase<typeof schema>,
  overrides: SeedOverrides = {},
): Promise<{ id: string; slug: string }> {
  const [row] = await db
    .insert(schema.routes)
    .values({
      slug: overrides.slug ?? "seeded-route",
      title: overrides.title ?? "Seeded Route",
      description: null,
      distanceM: 10000,
      elevationGainM: 30,
      recordedAt: new Date("2026-05-11T06:30:00.000Z"),
      region: null,
      tags: [],
      gpxPath: "gpx/2026/seed.gpx",
      geojson: SEED_GEOJSON,
      bbox: SEED_BBOX,
      startPoint: SEED_START,
      published: overrides.published ?? true,
    })
    .returning({ id: schema.routes.id, slug: schema.routes.slug });
  if (!row) throw new Error("seedRoute: insert returned no row");
  return row;
}

describe("updateRoute (non-DB regression)", () => {
  // These scenarios short-circuit BEFORE any DB I/O, so they do not require a
  // live Postgres and run unconditionally.

  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
  });

  describe("Scenario: Validation failure short-circuits without DB calls", () => {
    it("returns fieldErrors.slug, performs no DB calls", async () => {
      vi.resetModules();
      const selectSpy = vi.fn();
      const updateSpy = vi.fn();
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({ select: selectSpy, update: updateSpy }),
      }));

      const { updateRoute } = await import("../updateRoute");

      const result = await updateRoute({
        id: "00000000-0000-0000-0000-000000000001",
        title: "Some title",
        slug: "INVALID SLUG", // uppercase + space
        published: true,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors.slug).toBeDefined();
      expect(selectSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();

      vi.doUnmock("@/lib/db/client");
      vi.resetModules();
    });
  });

  describe("Scenario: GPX-derived keys sent by client are silently stripped", () => {
    it("never passes locked keys to db.update().set(...)", async () => {
      vi.resetModules();
      const setSpy = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateChain = vi.fn().mockReturnValue({ set: setSpy });
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ slug: "seeded-slug" }]),
          }),
        }),
      };
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({
          select: vi.fn().mockReturnValue(selectChain),
          update: updateChain,
        }),
      }));

      const { updateRoute } = await import("../updateRoute");

      const result = await updateRoute({
        id: "00000000-0000-0000-0000-000000000002",
        title: "Updated title",
        slug: "updated-slug",
        description: null,
        tags: ["foo"],
        published: true,
        // ── locked / GPX-derived keys the client tried to sneak in ──────
        gpx_path: "evil.gpx",
        geojson: { type: "LineString", coordinates: [] },
        bbox: { type: "Polygon", coordinates: [] },
        start_point: { type: "Point", coordinates: [0, 0] },
        distance_m: 99999,
        elevation_gain_m: 12345,
        recorded_at: new Date("2000-01-01T00:00:00.000Z"),
        created_at: new Date("2000-01-01T00:00:00.000Z"),
        // ── legacy fields stripped by feat-gpx-driven-route-metadata ────
        difficulty: "medium",
        duration_s: 1800,
        region: null,
      });

      expect(result.ok).toBe(true);
      expect(setSpy).toHaveBeenCalledTimes(1);
      const setArg = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).toBeDefined();

      // Every one of the nine locked keys must be absent — both the snake_case
      // wire names and the Drizzle camelCase column names.
      const forbidden = [
        "gpx_path",
        "gpxPath",
        "geojson",
        "bbox",
        "start_point",
        "startPoint",
        "distance_m",
        "distanceM",
        "elevation_gain_m",
        "elevationGainM",
        "recorded_at",
        "recordedAt",
        "id",
        "created_at",
        "createdAt",
      ];
      for (const k of forbidden) {
        expect(setArg).not.toHaveProperty(k);
      }

      // updated_at MUST be set to a fresh Date (camelCase column name).
      expect(setArg.updatedAt).toBeInstanceOf(Date);

      vi.doUnmock("@/lib/db/client");
      vi.resetModules();
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("updateRoute (integration)", () => {
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
    vi.mocked(revalidatePath).mockClear();
    await db.execute(sql`TRUNCATE TABLE routes CASCADE`);
  });

  describe("Scenario: Happy path with slug change revalidates both slug paths", () => {
    it("updates row, revalidates /routes + oldSlug + newSlug + /admin/routes", async () => {
      const { updateRoute } = await import("../updateRoute");
      const seeded = await seedRoute(db, {
        slug: "old-slug",
        title: "Original",
      });

      const result = await updateRoute({
        id: seeded.id,
        title: "Renamed",
        slug: "new-slug",
        description: "新描述",
        tags: ["河濱"],
        published: true,
      });

      expect(result.ok).toBe(true);

      // Row was updated; GPX-derived columns untouched.
      const rows = await db.execute<{
        slug: string;
        title: string;
        description: string | null;
        distance_m: number;
        gpx_path: string;
      }>(
        sql`SELECT slug, title, description, distance_m, gpx_path FROM routes WHERE id = ${seeded.id}`,
      );
      expect(rows.length).toBe(1);
      const row = rows[0]!;
      expect(row.slug).toBe("new-slug");
      expect(row.title).toBe("Renamed");
      expect(row.description).toBe("新描述");
      // GPX-derived columns should retain seeded values.
      expect(row.distance_m).toBe(10000);
      expect(row.gpx_path).toBe("gpx/2026/seed.gpx");

      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/old-slug");
      expect(calls).toContain("/routes/new-slug");
      expect(calls).toContain("/admin/routes");
      expect(calls.length).toBe(4);
    });
  });

  describe("Scenario: Happy path with same slug revalidates only one slug path", () => {
    it("dedupes revalidatePath when newSlug === oldSlug", async () => {
      const { updateRoute } = await import("../updateRoute");
      const seeded = await seedRoute(db, {
        slug: "stable-slug",
        title: "Original",
      });

      const result = await updateRoute({
        id: seeded.id,
        title: "Renamed Only",
        slug: "stable-slug", // identical
        published: true,
      });

      expect(result.ok).toBe(true);

      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/stable-slug");
      expect(calls).toContain("/admin/routes");
      // Exactly 3 (no duplicate slug path).
      expect(calls.length).toBe(3);
    });
  });

  describe("Scenario: Slug UNIQUE conflict surfaces fieldErrors.slug", () => {
    it("returns 此 slug 已被使用 and leaves the row's slug unchanged", async () => {
      const { updateRoute } = await import("../updateRoute");
      const rowA = await seedRoute(db, { slug: "a", title: "Row A" });
      await seedRoute(db, { slug: "b", title: "Row B" });

      const result = await updateRoute({
        id: rowA.id,
        title: "Row A Renamed",
        slug: "b", // collide with Row B's slug
        published: true,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors.slug).toBe("此 slug 已被使用");

      // Row A's slug must be unchanged.
      const rows = await db.execute<{ slug: string }>(
        sql`SELECT slug FROM routes WHERE id = ${rowA.id}`,
      );
      expect(rows[0]?.slug).toBe("a");
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });
  });
});
