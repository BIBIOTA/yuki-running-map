/**
 * Integration tests for the `deleteRoute` Server Action.
 *
 * Coverage split (documented for reviewers):
 *
 *   - The HAPPY PATH scenario seeds a real `routes` row via Drizzle and
 *     verifies that the row is gone, that the Storage `remove` was called
 *     with the exact `gpx_path`, and that the 3 `revalidatePath` calls
 *     fired. Storage is mocked at the `@/lib/supabase/server` module level
 *     because we do not require a live Supabase bucket to assert call
 *     semantics — only that the Action invokes `.remove([gpxPath])`. This
 *     scenario is gated by `describe.skipIf(!process.env.DATABASE_URL)`.
 *   - The UNKNOWN ID, STORAGE FAILURE (both `{ error }` and throw flavours),
 *     and DB DELETE FAILURE scenarios run unconditionally with a fully mocked
 *     `getDb` / `createServerClient`. No real Postgres needed — these
 *     scenarios only verify control-flow branching.
 *
 * `next/cache` is mocked at module scope; `revalidatePath` has no meaning
 * outside a Next.js request context.
 *
 * Per spec §deleteRoute (lines 122–150) and diagram
 * `02-sequence-delete-route.puml`:
 *   - Storage `remove` failure (either thrown or `{ error }`) MUST be
 *     swallowed with `console.warn('orphan gpx file', path, e)` AND the
 *     Action MUST still return `{ ok: true }` AND still revalidate.
 *   - DB DELETE throw MUST return `{ ok: false, message: '刪除失敗' }` AND
 *     skip both Storage cleanup AND `revalidatePath`.
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
  gpxPath?: string;
}

async function seedRoute(
  db: PostgresJsDatabase<typeof schema>,
  overrides: SeedOverrides = {},
): Promise<{ id: string; slug: string; gpxPath: string }> {
  const [row] = await db
    .insert(schema.routes)
    .values({
      slug: overrides.slug ?? "delete-me",
      title: overrides.title ?? "Delete Me",
      description: null,
      distanceM: 10000,
      elevationGainM: 30,
      durationS: null,
      recordedAt: new Date("2026-05-11T06:30:00.000Z"),
      region: null,
      tags: [],
      difficulty: "easy",
      gpxPath: overrides.gpxPath ?? "gpx/2026/delete-me.gpx",
      geojson: SEED_GEOJSON,
      bbox: SEED_BBOX,
      startPoint: SEED_START,
      published: true,
    })
    .returning({
      id: schema.routes.id,
      slug: schema.routes.slug,
      gpxPath: schema.routes.gpxPath,
    });
  if (!row) throw new Error("seedRoute: insert returned no row");
  return row;
}

describe("deleteRoute (non-DB regression)", () => {
  // These scenarios short-circuit OR mock the entire client surface, so they
  // do not require a live Postgres and run unconditionally.

  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
    vi.restoreAllMocks();
  });

  describe("Scenario: Unknown id returns ok true (idempotent)", () => {
    it("performs no DELETE, no Storage call, no revalidatePath", async () => {
      vi.resetModules();

      // db.select().from().where().limit() → []
      const limitSpy = vi.fn().mockResolvedValue([]);
      const whereSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
      const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });
      const deleteSpy = vi.fn();
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({ select: selectSpy, delete: deleteSpy }),
      }));

      const removeSpy = vi.fn();
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: () => ({
          storage: { from: () => ({ remove: removeSpy }) },
        }),
      }));

      const { deleteRoute } = await import("../deleteRoute");

      const result = await deleteRoute({
        id: "00000000-0000-0000-0000-000000000099",
      });

      expect(result).toEqual({ ok: true });
      expect(selectSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(removeSpy).not.toHaveBeenCalled();
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();

      vi.doUnmock("@/lib/db/client");
      vi.doUnmock("@/lib/supabase/server");
      vi.resetModules();
    });
  });

  describe("Scenario: Storage remove returns { error } — logs orphan, returns ok", () => {
    it("calls console.warn with 'orphan gpx file' and still revalidates 3 paths", async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const limitSpy = vi.fn().mockResolvedValue([
        { gpxPath: "gpx/2026/orphan.gpx", slug: "doomed" },
      ]);
      const selectChain = {
        from: () => ({ where: () => ({ limit: limitSpy }) }),
      };
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const deleteSpy = vi.fn().mockReturnValue({ where: deleteWhere });
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({
          select: vi.fn().mockReturnValue(selectChain),
          delete: deleteSpy,
        }),
      }));

      const storageError = { message: "oops" };
      const removeSpy = vi.fn().mockResolvedValue({
        data: null,
        error: storageError,
      });
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: () => ({
          storage: { from: () => ({ remove: removeSpy }) },
        }),
      }));

      const { deleteRoute } = await import("../deleteRoute");

      const result = await deleteRoute({
        id: "00000000-0000-0000-0000-000000000010",
      });

      expect(result).toEqual({ ok: true });
      expect(removeSpy).toHaveBeenCalledWith(["2026/orphan.gpx"]);
      expect(warnSpy).toHaveBeenCalledWith(
        "orphan gpx file",
        "gpx/2026/orphan.gpx",
        storageError,
      );

      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/doomed");
      expect(calls).toContain("/admin/routes");
      expect(calls.length).toBe(3);

      vi.doUnmock("@/lib/db/client");
      vi.doUnmock("@/lib/supabase/server");
      vi.resetModules();
    });
  });

  describe("Scenario: Storage remove THROWS — logs orphan, returns ok", () => {
    it("swallows the throw, logs warn, still revalidates 3 paths", async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const limitSpy = vi.fn().mockResolvedValue([
        { gpxPath: "gpx/2026/boom.gpx", slug: "boom" },
      ]);
      const selectChain = {
        from: () => ({ where: () => ({ limit: limitSpy }) }),
      };
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const deleteSpy = vi.fn().mockReturnValue({ where: deleteWhere });
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({
          select: vi.fn().mockReturnValue(selectChain),
          delete: deleteSpy,
        }),
      }));

      const thrownErr = new Error("network down");
      const removeSpy = vi.fn().mockRejectedValue(thrownErr);
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: () => ({
          storage: { from: () => ({ remove: removeSpy }) },
        }),
      }));

      const { deleteRoute } = await import("../deleteRoute");

      const result = await deleteRoute({
        id: "00000000-0000-0000-0000-000000000011",
      });

      expect(result).toEqual({ ok: true });
      expect(removeSpy).toHaveBeenCalledWith(["2026/boom.gpx"]);
      expect(warnSpy).toHaveBeenCalledWith(
        "orphan gpx file",
        "gpx/2026/boom.gpx",
        thrownErr,
      );

      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/boom");
      expect(calls).toContain("/admin/routes");
      expect(calls.length).toBe(3);

      vi.doUnmock("@/lib/db/client");
      vi.doUnmock("@/lib/supabase/server");
      vi.resetModules();
    });
  });

  describe("Scenario: DB DELETE throw returns { ok:false, message:'刪除失敗' }", () => {
    it("skips Storage remove AND revalidatePath", async () => {
      vi.resetModules();
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const limitSpy = vi.fn().mockResolvedValue([
        { gpxPath: "gpx/2026/locked.gpx", slug: "locked" },
      ]);
      const selectChain = {
        from: () => ({ where: () => ({ limit: limitSpy }) }),
      };
      const deleteWhere = vi.fn().mockRejectedValue(new Error("FK violation"));
      const deleteSpy = vi.fn().mockReturnValue({ where: deleteWhere });
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({
          select: vi.fn().mockReturnValue(selectChain),
          delete: deleteSpy,
        }),
      }));

      const removeSpy = vi.fn();
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: () => ({
          storage: { from: () => ({ remove: removeSpy }) },
        }),
      }));

      const { deleteRoute } = await import("../deleteRoute");

      const result = await deleteRoute({
        id: "00000000-0000-0000-0000-000000000012",
      });

      expect(result).toEqual({ ok: false, message: "刪除失敗" });
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).not.toHaveBeenCalled();
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();

      vi.doUnmock("@/lib/db/client");
      vi.doUnmock("@/lib/supabase/server");
      vi.resetModules();
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("deleteRoute (integration)", () => {
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
    vi.resetModules();
    await db.execute(sql`TRUNCATE TABLE routes CASCADE`);
  });

  describe("Scenario: Happy path deletes row, calls Storage remove with gpx_path, revalidates 3 paths", () => {
    it("row is gone, remove called once, returns { ok: true }", async () => {
      const removeSpy = vi.fn().mockResolvedValue({ data: [{}], error: null });
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: () => ({
          storage: { from: () => ({ remove: removeSpy }) },
        }),
      }));

      const { deleteRoute } = await import("../deleteRoute");
      const seeded = await seedRoute(db, {
        slug: "happy-delete",
        title: "Happy Delete",
        gpxPath: "gpx/2026/happy.gpx",
      });

      const result = await deleteRoute({ id: seeded.id });

      expect(result).toEqual({ ok: true });

      // Row is gone.
      const rows = await db.execute<{ id: string }>(
        sql`SELECT id FROM routes WHERE id = ${seeded.id}`,
      );
      expect(rows.length).toBe(0);

      // Storage remove was called with the exact gpx_path.
      expect(removeSpy).toHaveBeenCalledWith(["2026/happy.gpx"]);

      // revalidatePath fired for /routes, /routes/<slug>, /admin/routes.
      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/happy-delete");
      expect(calls).toContain("/admin/routes");
      expect(calls.length).toBe(3);

      vi.doUnmock("@/lib/supabase/server");
    });
  });
});
