/**
 * Shared post-action verification helpers for Playwright e2e specs.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.3
 *
 * - `routeExistsById(id)` — returns whether a `routes` row with the
 *   given id is currently present in Postgres. Used after the admin
 *   delete flow to prove the DB UPDATE actually committed.
 * - `gpxObjectExists(path)` — returns whether a Storage object at the
 *   given path exists in the `gpx` bucket. Uses the Supabase Storage
 *   admin REST API; a 200 from the public-info endpoint means the
 *   object exists, 400/404 means it does not. Used to prove the
 *   Storage delete side-effect of `deleteRoute()` actually fired.
 * - `uploadSeedGpxObject(path)` — uploads a tiny placeholder buffer to
 *   the given path so `gpxObjectExists()` returns true BEFORE the
 *   delete action runs. `seedRoute()` only inserts a DB row — without
 *   this, the spec cannot distinguish "delete worked" from "the file
 *   was never there to begin with".
 *
 * All three follow the lazy-import + DATABASE_URL pattern established
 * by `dbCleanup.ts` and `seed.ts`: helpers throw if env is missing so
 * the calling spec (whose entire describe is `test.skip`'d when env is
 * missing) never reaches them on machines without a live Supabase.
 */

import { DATABASE_URL, SERVICE_ROLE_KEY, SUPABASE_URL } from "./adminAuth";

interface RouteIdRow {
  id: string;
}

export async function routeExistsById(id: string): Promise<boolean> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to query routes");
  }
  // Lazy-import: same reasoning as `dbCleanup.truncateRoutes()` —
  // keep `postgres` out of Playwright's `--list` static analysis.
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    const rows = await sql<RouteIdRow[]>`SELECT id FROM routes WHERE id = ${id} LIMIT 1`;
    return rows.length > 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Probe a Storage object's existence by issuing a HEAD against the
 * Supabase Storage admin REST endpoint. The service-role-keyed
 * `/storage/v1/object/{bucket}/{path}` endpoint returns 200 when the
 * object is present and 400/404 when it is not. Any other status is
 * treated as a hard error so we don't silently misreport.
 */
export async function gpxObjectExists(path: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set to probe the gpx bucket",
    );
  }

  // The DB stores `gpx_path` as e.g. `gpx/2026/foo.gpx` — i.e. the
  // bucket name is included. The Storage REST endpoint takes the
  // bucket separately, so strip a leading `gpx/` if present to keep
  // the helper tolerant of either convention.
  const objectKey = path.startsWith("gpx/") ? path.slice("gpx/".length) : path;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/gpx/${encodeURI(objectKey)}`,
    {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    },
  );
  if (res.status === 200) return true;
  if (res.status === 400 || res.status === 404) return false;
  throw new Error(
    `Supabase storage HEAD failed: ${res.status} ${await res.text().catch(() => "")}`,
  );
}

/**
 * Upload a small placeholder GPX buffer to the given path inside the
 * `gpx` bucket so the delete flow has an actual object to delete.
 * The payload is a minimal but well-formed GPX document — `deleteRoute`
 * does not parse it, but using a realistic structure keeps the seed
 * usable for any future spec that wants to download/inspect it.
 *
 * Uses `upsert: true` so re-running the spec on a dirty bucket is
 * idempotent without forcing every caller to `clearGpxBucket()` first
 * (the `beforeEach` already does, but this keeps the helper robust).
 */
export async function uploadSeedGpxObject(path: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set to upload to the gpx bucket",
    );
  }

  const objectKey = path.startsWith("gpx/") ? path.slice("gpx/".length) : path;
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="run-map e2e seed" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    "  <trk><name>seed</name><trkseg>\n" +
    '    <trkpt lat="25.0" lon="121.5"/>\n' +
    '    <trkpt lat="25.01" lon="121.51"/>\n' +
    "  </trkseg></trk>\n" +
    "</gpx>\n";

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/gpx/${encodeURI(objectKey)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/gpx+xml",
        "x-upsert": "true",
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Supabase storage upload failed: ${res.status} ${await res.text()}`,
    );
  }
}
