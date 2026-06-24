/**
 * Integration tests for the `createRoute` Server Action.
 *
 * Requires a live Postgres at `process.env.DATABASE_URL` AND a running
 * Supabase Storage with the `gpx` bucket migrated. The whole suite is gated
 * via `describe.skipIf(!process.env.DATABASE_URL)` so contributors and CI
 * jobs without a local Supabase don't see false failures — when the env var
 * is absent, vitest reports the suite as **skipped**, not failed.
 *
 * Each test runs against a freshly-truncated `routes` table; the `gpx`
 * Storage bucket is also swept clean of any objects whose path was generated
 * during the previous test.
 *
 * Coverage split (intentional, documented for reviewers):
 *
 *   - Scenarios 1 (happy path) and 5 (slug UNIQUE conflict + Storage
 *     rollback) run against the REAL Supabase + Postgres so we verify
 *     wire-level behaviour — actual row insertion, actual object upload,
 *     actual `routes_slug_unique` constraint hit, actual `storage.remove`.
 *   - Scenarios 2 (metadata validation), 3 (parseGpx throw), 4 (Storage
 *     upload throw), and 6 (generic INSERT throw) use `vi.mock(...)` at
 *     module level to inject controllable doubles. Mocking is the cleanest
 *     way to deterministically trigger the `_form` and `parseGpx` branches
 *     without polluting the database or relying on a specific Supabase
 *     internal error shape.
 *
 * `next/cache` is always mocked at module level (the Server Action calls
 * `revalidatePath` which has no meaning outside a Next.js request context).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { revalidatePath } from "next/cache";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const SAMPLE_GPX_PATH = path.resolve(
  __dirname,
  "../../../../lib/gpx/__fixtures__/sample.gpx",
);

const EMPTY_GPX = Buffer.from(
  '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"></gpx>',
);

async function readSampleGpx(): Promise<Buffer> {
  return readFile(SAMPLE_GPX_PATH);
}

async function makeGpxFormData(
  buffer: Buffer,
  overrides: Partial<{
    title: string;
    slug: string;
    description: string;
    published: string;
  }> = {},
): Promise<FormData> {
  const fd = new FormData();
  fd.append("title", overrides.title ?? "Sample Route");
  fd.append("slug", overrides.slug ?? "sample-route");
  if (overrides.description !== undefined) fd.append("description", overrides.description);
  fd.append("published", overrides.published ?? "true");

  const file = new File([new Uint8Array(buffer)], "sample.gpx", {
    type: "application/gpx+xml",
  });
  fd.append("gpxFile", file);
  return fd;
}

describe("createRoute (parse-boundary)", () => {
  // These scenarios short-circuit at FormData parsing BEFORE any I/O, so they
  // do not require a live Supabase or Postgres and run unconditionally.

  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
  });

  describe("Malformed metadata is rejected without touching Storage or DB", () => {
    it("rejects missing title without Storage upload or DB write", async () => {
      vi.resetModules();
      const uploadSpy = vi.fn();
      const removeSpy = vi.fn();
      const insertSpy = vi.fn();
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: vi.fn().mockResolvedValue({
          storage: {
            from: () => ({ upload: uploadSpy, remove: removeSpy }),
          },
        }),
      }));
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({ insert: insertSpy }),
      }));

      const { createRoute } = await import("../createRoute");

      const fd = new FormData();
      fd.append("title", ""); // invalid: empty title
      fd.append("slug", "some-slug");
      fd.append("published", "true");
      const file = new File([new Uint8Array(Buffer.from("ignored"))], "sample.gpx", {
        type: "application/gpx+xml",
      });
      fd.append("gpxFile", file);

      const result = await createRoute(fd);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors.title).toBeTruthy();

      // No I/O: neither Storage nor DB nor cache revalidation.
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(removeSpy).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();

      vi.doUnmock("@/lib/supabase/server");
      vi.doUnmock("@/lib/db/client");
      vi.resetModules();
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("createRoute (integration)", () => {
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

    // Clear any objects under gpx/* that previous tests may have uploaded.
    try {
      const supabase = await createServerClient();
      const { data: years } = await supabase.storage.from("gpx").list("");
      for (const yearEntry of years ?? []) {
        const yearPath = yearEntry.name;
        const { data: files } = await supabase.storage
          .from("gpx")
          .list(yearPath);
        const paths = (files ?? []).map((f) => `${yearPath}/${f.name}`);
        if (paths.length > 0) {
          await supabase.storage.from("gpx").remove(paths);
        }
      }
    } catch {
      // best-effort cleanup; tests will still pass if the bucket is empty.
    }
  });

  describe("Scenario: Happy path creates row and Storage object", () => {
    it("uploads to gpx/{yyyy}/{uuid}.gpx, INSERTs row, revalidates 3 paths", async () => {
      const { createRoute } = await import("../createRoute");
      const buffer = await readSampleGpx();
      const formData = await makeGpxFormData(buffer, {
        slug: "happy-path",
        title: "Happy Path",
      });

      const result = await createRoute(formData);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.slug).toBe("happy-path");
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      // Row landed
      const rows = await db.execute<{
        slug: string;
        gpx_path: string;
        elevation_profile: Array<[number, number]>;
      }>(
        sql`SELECT slug, gpx_path, elevation_profile FROM routes WHERE slug = 'happy-path'`,
      );
      expect(rows.length).toBe(1);
      const row = rows[0]!;
      expect(row.gpx_path).toMatch(/^gpx\/\d{4}\/[0-9a-f-]+\.gpx$/);

      // Sample fixture has continuous <ele>; expect a non-empty profile that
      // starts at distance 0 and respects the [2, 300] simplification band.
      expect(Array.isArray(row.elevation_profile)).toBe(true);
      expect(row.elevation_profile.length).toBeGreaterThanOrEqual(2);
      expect(row.elevation_profile.length).toBeLessThanOrEqual(300);
      expect(row.elevation_profile[0]?.[0]).toBe(0);

      // revalidatePath called for all three URLs
      const calls = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
      expect(calls).toContain("/routes");
      expect(calls).toContain("/routes/happy-path");
      expect(calls).toContain("/admin/routes");
    });

    it("persists elevation_profile = [] for GPX without <ele>", async () => {
      const { createRoute } = await import("../createRoute");
      const noEleBuffer = await readFile(
        path.resolve(
          __dirname,
          "../../../../lib/gpx/__fixtures__/no-elevation.gpx",
        ),
      );
      const formData = await makeGpxFormData(noEleBuffer, {
        slug: "offshore-swim",
        title: "Offshore Swim",
      });

      const result = await createRoute(formData);
      expect(result.ok).toBe(true);

      const rows = await db.execute<{
        elevation_profile: Array<[number, number]>;
      }>(
        sql`SELECT elevation_profile FROM routes WHERE slug = 'offshore-swim'`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0]?.elevation_profile).toEqual([]);
    });
  });

  describe("Scenario: Metadata validation failure rejects without writes", () => {
    it("returns fieldErrors.slug without uploading or inserting", async () => {
      const { createRoute } = await import("../createRoute");
      const buffer = await readSampleGpx();
      const formData = await makeGpxFormData(buffer, {
        slug: "Foo Bar", // invalid: uppercase + space
      });

      const result = await createRoute(formData);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors.slug).toBeDefined();

      const rows = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM routes`,
      );
      expect(rows[0]?.count).toBe(0);
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });
  });

  describe("Scenario: Server-side parseGpx failure rejects without Storage write", () => {
    it("returns fieldErrors.gpxFile when GPX has no trackpoints", async () => {
      const { createRoute } = await import("../createRoute");
      const formData = await makeGpxFormData(EMPTY_GPX, {
        slug: "no-trackpoints",
      });

      const result = await createRoute(formData);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors.gpxFile).toBe("GPX 解析失敗（無有效軌跡點？）");

      const rows = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM routes`,
      );
      expect(rows[0]?.count).toBe(0);
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });
  });

  describe("Scenario: Storage upload failure surfaces _form error without DB write", () => {
    it("returns _form error and does not INSERT when storage.upload throws", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: vi.fn().mockResolvedValue({
          storage: {
            from: () => ({
              upload: vi.fn().mockRejectedValue(new Error("network down")),
              remove: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          },
        }),
      }));

      const { createRoute } = await import("../createRoute");
      const buffer = await readSampleGpx();
      const formData = await makeGpxFormData(buffer, {
        slug: "storage-throw",
      });

      const result = await createRoute(formData);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors._form).toBe("Storage 上傳失敗，請重試");

      const rows = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM routes WHERE slug = 'storage-throw'`,
      );
      expect(rows[0]?.count).toBe(0);
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();

      vi.doUnmock("@/lib/supabase/server");
      vi.resetModules();
    });
  });

  describe("Scenario: Slug UNIQUE conflict rolls back Storage upload", () => {
    it("removes uploaded object and returns fieldErrors.slug", async () => {
      const { createRoute } = await import("../createRoute");
      const buffer = await readSampleGpx();

      // Seed: first call succeeds with slug `dup`.
      const seedResult = await createRoute(
        await makeGpxFormData(buffer, { slug: "dup", title: "Seed" }),
      );
      expect(seedResult.ok).toBe(true);

      // Second call collides on the slug.
      const collideResult = await createRoute(
        await makeGpxFormData(buffer, { slug: "dup", title: "Collide" }),
      );

      expect(collideResult.ok).toBe(false);
      if (collideResult.ok) return;
      expect(collideResult.fieldErrors.slug).toBe("此 slug 已被使用");

      // Verify only the seed row exists (the collide upload was rolled back).
      const rows = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM routes WHERE slug = 'dup'`,
      );
      expect(rows[0]?.count).toBe(1);

      // Verify there is exactly one Storage object under gpx/{yyyy}/ — the
      // seed's object — because the collide attempt's object was removed by
      // the rollback.
      const supabase = await createServerClient();
      const { data: years } = await supabase.storage.from("gpx").list("");
      let totalObjects = 0;
      for (const yearEntry of years ?? []) {
        const { data: files } = await supabase.storage
          .from("gpx")
          .list(yearEntry.name);
        totalObjects += (files ?? []).length;
      }
      expect(totalObjects).toBe(1);
    });
  });

  describe("Scenario: Other INSERT failure rolls back Storage and reports _form", () => {
    it("invokes Storage rollback, returns _form, logs error", async () => {
      vi.resetModules();
      const removeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.doMock("@/lib/supabase/server", () => ({
        createServerClient: vi.fn().mockResolvedValue({
          storage: {
            from: () => ({
              upload: vi.fn().mockResolvedValue({ data: { path: "x" }, error: null }),
              remove: removeSpy,
            }),
          },
        }),
      }));
      vi.doMock("@/lib/db/client", () => ({
        getDb: () => ({
          insert: () => ({
            values: () => ({
              returning: vi
                .fn()
                .mockRejectedValue(new Error("boom: generic insert failure")),
            }),
          }),
        }),
      }));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { createRoute } = await import("../createRoute");
      const buffer = await readSampleGpx();
      const formData = await makeGpxFormData(buffer, {
        slug: "generic-insert-throw",
      });

      const result = await createRoute(formData);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.fieldErrors._form).toMatch(/^寫入失敗：/);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
      vi.doUnmock("@/lib/supabase/server");
      vi.doUnmock("@/lib/db/client");
      vi.resetModules();
    });
  });
});
