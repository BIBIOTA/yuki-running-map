import { describe, expect, it } from "vitest";

import { isPgUniqueViolation } from "../errors";

/**
 * Mimic the shape the `postgres` package throws: an `Error` subclass with
 * string `code` (SQLSTATE) and snake_case `constraint_name`.
 */
class PostgresError extends Error {
  code: string;
  constraint_name: string;
  constructor(code: string, constraint_name: string) {
    super(`pg ${code}`);
    this.code = code;
    this.constraint_name = constraint_name;
  }
}

describe("isPgUniqueViolation", () => {
  it("returns true for 23505 with matching constraint", () => {
    const error = new PostgresError("23505", "routes_slug_unique");
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(true);
  });

  it("returns false for 23505 with mismatched constraint", () => {
    const error = new PostgresError("23505", "routes_pkey");
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(false);
  });

  it("returns false for non-23505 code (foreign-key violation) with matching constraint name", () => {
    const error = new PostgresError("23503", "routes_slug_unique");
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(false);
  });

  it("returns false for plain object without code field", () => {
    const error = { constraint_name: "routes_slug_unique" };
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(false);
  });

  it("returns false for plain object without constraint_name field", () => {
    const error = { code: "23505" };
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPgUniqueViolation(null, "routes_slug_unique")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPgUniqueViolation(undefined, "routes_slug_unique")).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isPgUniqueViolation("some string", "routes_slug_unique")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isPgUniqueViolation(123, "routes_slug_unique")).toBe(false);
  });

  it("returns false for numeric code 23505 (driver uses string)", () => {
    const error = { code: 23505, constraint_name: "routes_slug_unique" };
    expect(isPgUniqueViolation(error, "routes_slug_unique")).toBe(false);
  });
});
