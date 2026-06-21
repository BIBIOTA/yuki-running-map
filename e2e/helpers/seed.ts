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
 * difficulty / gpx_path / geojson / bbox / start_point). Defaults take
 * care of `id` (gen_random_uuid), `published` (false), `tags` ('{}'),
 * `created_at`, `updated_at`.
 *
 * RETURNING gives back the server-generated `id` (uuid) so the caller
 * can navigate to `/admin/routes/{id}` without an extra SELECT.
 */

import { DATABASE_URL } from "./adminAuth";

export interface SeedRouteOverrides {
  slug?: string;
  title?: string;
  distanceM?: number;
  elevationGainM?: number;
  recordedAt?: Date;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  gpxPath?: string;
  published?: boolean;
  description?: string | null;
  region?: string | null;
  locationName?: string | null;
  durationS?: number | null;
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
  const tags = overrides.tags ?? ["河濱"];
  const difficulty = overrides.difficulty ?? "easy";
  const gpxPath = overrides.gpxPath ?? "gpx/2026/seed.gpx";
  const published = overrides.published ?? false;
  const description = overrides.description ?? null;
  const region = overrides.region ?? null;
  const locationName = overrides.locationName ?? null;
  const durationS = overrides.durationS ?? null;

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
        duration_s,
        recorded_at,
        location_name,
        region,
        tags,
        difficulty,
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
        ${durationS},
        ${recordedAt.toISOString()},
        ${locationName},
        ${region},
        ${sql.array(tags, 1009)},
        ${difficulty}::difficulty,
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
