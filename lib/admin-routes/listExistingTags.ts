/**
 * Drizzle helper that returns the union of all tags currently stored across
 * every row in the `routes` table, as a distinct, sorted `string[]`.
 *
 * Intended for SSR prefetch in the admin pages (`/admin/upload` and
 * `/admin/routes/[id]`), so the client-side tag picker can offer autocomplete
 * suggestions based on tags that already exist in the database. The helper
 * accepts a Drizzle client as an argument (rather than constructing its own)
 * so it stays trivial to swap a test client in integration tests.
 *
 * Implementation note: Drizzle does not expose a typed `unnest(text[])` query
 * builder, so the SQL is hand-rolled via the `sql` template tag. Ordering is
 * applied in SQL (`ORDER BY tag`) to keep UI rendering deterministic. A null
 * filter on the JS side is defensive — the `tags` column is `notNull` with a
 * `'{}'::text[]` default, but `unnest` over a row that somehow contains a null
 * element would still produce a null, and we never want that to leak into UI
 * suggestions.
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";

export async function listExistingTags(
  db: PostgresJsDatabase<typeof schema>,
): Promise<string[]> {
  const rows = await db.execute<{ tag: string | null }>(
    sql`SELECT DISTINCT unnest(tags) AS tag FROM routes ORDER BY tag`,
  );

  const result: string[] = [];
  for (const row of rows) {
    if (typeof row.tag === "string" && row.tag.length > 0) {
      result.push(row.tag);
    }
  }
  return result;
}
