/**
 * Shared database seed helpers for Playwright e2e specs.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.2
 *
 * `seedRoute()` inserts a single `routes` row via the direct Postgres
 * connection (`DATABASE_URL` — service role on Supabase, bypassing
 * RLS). Used by specs that need to start from a known route fixture
 * — e.g. the admin edit flow (§5.2) and the visitor detail flow (§5.3).
 *
 * Why raw SQL rather than Drizzle's `.insert()`:
 *   The `bbox` and `start_point` columns are PostGIS geometries that need
 *   `ST_GeomFromText(..., 4326)`. Drizzle's typed insert APIs require a
 *   `GeoJSON | string` value via the custom `geometryPolygon4326` /
 *   `geometryPoint4326` column helpers, which would force every caller
 *   to construct WKT strings inline. Using a raw `INSERT ... VALUES`
 *   keeps the seed signature small (just override the metadata columns
 *   the caller cares about) and mirrors the established pattern in
 *   `lib/admin-routes/__tests__/listExistingTags.integration.test.ts`.
 *
 * The default values satisfy every `NOT NULL` column without a default
 * (slug / title / distance_m / elevation_gain_m / recorded_at /
 * gpx_path / geojson / bbox / start_point). Defaults take care of
 * `id` (gen_random_uuid), `published` (false),
 * `created_at`, `updated_at`. Legacy difficulty / duration_s columns
 * are dropped by migration 0004.
 *
 * RETURNING gives back the server-generated `id` (uuid) so the caller
 * can navigate to `/admin/routes/{id}` without an extra SELECT.
 */

import { DATABASE_URL } from "./adminAuth";

export interface AdminUnitFixture {
  code: string;
  level: "county" | "township";
  name: string;
  parent_code?: string | null;
  /** GeoJSON MultiPolygon coordinates, e.g. [[[[lon,lat],...]]]. */
  coordinates: number[][][][];
}

/**
 * Insert one or more admin_units rows for an e2e test. Returns the IDs in
 * the same order the fixtures were supplied.
 *
 * The migration-time seed (0007) covers 5 features that the production
 * spec relies on; this helper exists for tests that need a tiny isolated
 * dataset (e.g., to assert spatial detection against a known mini polygon).
 */
export async function seedAdminUnits(
  fixtures: AdminUnitFixture[],
): Promise<string[]> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to seed admin_units");
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    const ids: string[] = [];
    for (const fixture of fixtures) {
      const geojson = JSON.stringify({
        type: "MultiPolygon",
        coordinates: fixture.coordinates,
      });
      const rows = await sql<Array<{ id: string }>>`
        INSERT INTO admin_units (code, level, name, parent_code, geom)
        VALUES (
          ${fixture.code},
          ${fixture.level}::admin_level,
          ${fixture.name},
          ${fixture.parent_code ?? null},
          ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326))::geometry(MultiPolygon, 4326)
        )
        RETURNING id
      `;
      const row = rows[0];
      if (!row) throw new Error("seedAdminUnits: INSERT returned no row");
      ids.push(row.id);
    }
    return ids;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function clearAdminUnits(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to clear admin_units");
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    // TRUNCATE CASCADE wipes route_admin_units join rows too.
    await sql`TRUNCATE TABLE admin_units CASCADE`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export interface SeedRouteOverrides {
  slug?: string;
  title?: string;
  distanceM?: number;
  elevationGainM?: number;
  recordedAt?: Date;
  gpxPath?: string;
  published?: boolean;
  description?: string | null;
  locationName?: string | null;
}

export interface SeededRoute {
  id: string;
  slug: string;
  title: string;
  gpxPath: string;
}

interface SeedRouteRow {
  id: string;
  slug: string;
  title: string;
  gpx_path: string;
}

export async function seedRoute(
  overrides: SeedRouteOverrides = {},
): Promise<SeededRoute> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to seed a route");
  }

  const slug = overrides.slug ?? "seed-route";
  const title = overrides.title ?? "已種子路線";
  const distanceM = overrides.distanceM ?? 5000;
  const elevationGainM = overrides.elevationGainM ?? 100;
  const recordedAt = overrides.recordedAt ?? new Date();
  const gpxPath = overrides.gpxPath ?? "gpx/2026/seed.gpx";
  const published = overrides.published ?? false;
  const description = overrides.description ?? null;
  const locationName = overrides.locationName ?? null;

  // Lazy-import: same reasoning as `dbCleanup.truncateRoutes()` —
  // keep `postgres` out of Playwright's `--list` static analysis.
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    const rows = await sql<SeedRouteRow[]>`
      INSERT INTO routes (
        slug,
        title,
        description,
        distance_m,
        elevation_gain_m,
        recorded_at,
        location_name,
        gpx_path,
        geojson,
        bbox,
        start_point,
        published
      ) VALUES (
        ${slug},
        ${title},
        ${description},
        ${distanceM},
        ${elevationGainM},
        ${recordedAt.toISOString()},
        ${locationName},
        ${gpxPath},
        ${'{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.5,25.0],[121.51,25.01]]},"properties":{}}'}::jsonb,
        ST_GeomFromText('POLYGON((121.5 25, 121.51 25, 121.51 25.01, 121.5 25.01, 121.5 25))', 4326),
        ST_GeomFromText('POINT(121.5 25)', 4326),
        ${published}
      )
      RETURNING id, slug, title, gpx_path
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("seedRoute: INSERT returned no rows");
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      gpxPath: row.gpx_path,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
