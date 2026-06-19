import { describe, expect, it } from "vitest";

import { buildEditPath, classifyStatus, formatRecordedAt } from "../routeListView";

describe("formatRecordedAt", () => {
  describe("Scenario: format a Date as YYYY-MM-DD (UTC)", () => {
    it("formats a mid-day UTC timestamp using the UTC date slice", () => {
      expect(formatRecordedAt(new Date("2026-06-19T15:30:00Z"))).toBe("2026-06-19");
    });

    it("formats the very start of a UTC year as the same calendar day", () => {
      expect(formatRecordedAt(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
    });

    it("formats the last second of a UTC year as the same calendar day", () => {
      expect(formatRecordedAt(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12-31");
    });
  });
});

describe("buildEditPath", () => {
  describe("Scenario: build /admin/routes/{id}", () => {
    it("interpolates a uuid-shaped id into the canonical route path", () => {
      expect(buildEditPath("abc-123")).toBe("/admin/routes/abc-123");
    });

    it("returns a sensible path even for an empty id (caller responsibility)", () => {
      expect(buildEditPath("")).toBe("/admin/routes/");
    });
  });
});

describe("classifyStatus", () => {
  describe("Scenario: published row", () => {
    it("returns the published variant when the column is true", () => {
      expect(classifyStatus(true)).toEqual({ kind: "published" });
    });
  });

  describe("Scenario: draft row", () => {
    it("returns the draft variant when the column is false", () => {
      expect(classifyStatus(false)).toEqual({ kind: "draft" });
    });
  });
});
