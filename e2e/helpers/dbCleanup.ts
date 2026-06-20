/**
 * Shared database cleanup helpers for Playwright e2e specs.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.1
 *
 * - `truncateRoutes()` wipes the `routes` table via the direct Postgres
 *   connection (`DATABASE_URL` — service role on Supabase, bypassing
 *   RLS). `CASCADE` ensures dependent FKs (if any are added later) are
 *   handled too.
 * - `clearGpxBucket()` lists every object in the `gpx` Storage bucket
 *   via the Supabase Storage REST API and deletes them in one call so
 *   the next upload run starts from a clean slate.
 */

import { DATABASE_URL, SERVICE_ROLE_KEY, SUPABASE_URL } from "./adminAuth";

export async function truncateRoutes(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to truncate routes");
  }
  // Lazy-import: the `postgres` package is a CommonJS module that
  // Playwright's test-discovery (`--list`) cannot statically analyse
  // when imported at the top of the file. Pulling it in inside the
  // function keeps `--list` working when env is missing (the entire
  // `describe` is `test.skip`'d before `beforeEach` ever runs).
  const { default: postgres } = await import("postgres");
  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    await sql`TRUNCATE TABLE routes CASCADE`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

interface StorageObject {
  name: string;
}

export async function clearGpxBucket(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set to clear the gpx bucket",
    );
  }

  // List every object in the bucket (recursive: prefix "").
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/gpx`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: "",
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!listRes.ok) {
    throw new Error(`Supabase storage list failed: ${listRes.status} ${await listRes.text()}`);
  }
  const objects = (await listRes.json()) as StorageObject[];
  if (objects.length === 0) return;

  const prefixes = objects.map((obj) => obj.name);

  const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/gpx`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes }),
  });
  if (!deleteRes.ok) {
    throw new Error(
      `Supabase storage delete failed: ${deleteRes.status} ${await deleteRes.text()}`,
    );
  }
}
