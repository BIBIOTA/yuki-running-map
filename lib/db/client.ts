/**
 * Lazy Drizzle client factory for server-runtime database access.
 *
 * Used by Server Actions and Server Components that need to run authoritative
 * SQL against the project Postgres (Supabase). Construction is deferred until
 * the first call to `getDb()` so that:
 *
 *   - test environments without `DATABASE_URL` don't blow up at import-time
 *     (the `describe.skipIf(!process.env.DATABASE_URL)` guard runs first);
 *   - we never open a pool during Next.js build or for code paths that don't
 *     actually touch the database.
 *
 * The underlying `postgres` client is created with `{ prepare: false }`. This
 * is mandatory for Supabase's pooled connection string (port 6543, transaction
 * pool mode) — pgBouncer in transaction-pool mode disallows server-side
 * prepared statements, and the `postgres` package's automatic prepared
 * statement caching breaks against it without this flag.
 *
 * Note: Drizzle (via the `postgres` package) connects with the role embedded
 * in `DATABASE_URL` and therefore bypasses Supabase Row-Level Security on the
 * `routes` table. This is acceptable for this codebase because the admin
 * Server Actions that use `getDb()` are gated by the `middleware.ts` admin
 * check (Wave C) — middleware is the security boundary, not RLS, on the
 * Server Action call path.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Db | null = null;

export function getDb(): Db {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  cachedDb = drizzle(postgres(url, { prepare: false }), { schema });
  return cachedDb;
}
