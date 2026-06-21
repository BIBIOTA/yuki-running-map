/**
 * Discriminators for errors thrown by the `postgres` package.
 *
 * The `createRoute` / `updateRoute` Server Actions need to distinguish a
 * slug-uniqueness conflict (so the form can surface
 * `fieldErrors.slug = '此 slug 已被使用'`) from any other DB failure (which
 * collapses to a generic `_form` error). The decision is made by inspecting
 * the SQLSTATE + constraint name on the thrown error, which is the wire shape
 * the `postgres` driver exposes.
 *
 * We deliberately do NOT use `instanceof PostgresError` here: it would pull
 * the `postgres` runtime into modules that only need the decision gate, and
 * it would force tests to construct a real `PostgresError`. Instead, this
 * helper structurally probes the unknown input — safe for any `catch (e)`
 * caller, regardless of whether `e` is an `Error`, `null`, or a primitive.
 */

/**
 * SQLSTATE class 23 / unique_violation. The `postgres` package exposes
 * `code` as a string (not a number), matching what PostgreSQL sends on the
 * wire.
 */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Returns `true` iff `error` is a non-null object whose `code` matches the
 * PostgreSQL unique-violation SQLSTATE (`'23505'`) AND whose `constraint_name`
 * exactly matches `constraintName`.
 *
 * `code` and `constraint_name` are read using the snake_case names the
 * `postgres` package uses — this is intentional, not a bug. Do NOT pass
 * a camelCase constraint name; callers must use the literal constraint
 * identifier from the migration (e.g. `'routes_slug_unique'`).
 *
 * Returns `false` for any non-matching input, including `null`, `undefined`,
 * strings, numbers, objects without a `code` field, and matching `code` with
 * a mismatched constraint. Never throws.
 */
export function isPgUniqueViolation(error: unknown, constraintName: string): boolean {
  // Walk the `cause` chain so we transparently unwrap Drizzle's
  // `DrizzleQueryError` (which wraps the original `PostgresError` as `.cause`)
  // and any other middleware wrapper. Cap the walk at 5 hops to defend
  // against pathological cycles.
  let current: unknown = error;
  for (let i = 0; i < 5; i++) {
    if (typeof current !== "object" || current === null) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (record.code === PG_UNIQUE_VIOLATION && record.constraint_name === constraintName) {
      return true;
    }
    if (!("cause" in record) || record.cause === current) {
      return false;
    }
    current = record.cause;
  }
  return false;
}
