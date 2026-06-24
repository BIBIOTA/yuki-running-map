import { describe, expect, it } from "vitest";

import { validateRouteMetadata } from "../validation";

/**
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       MODIFIED Requirement "RouteMetadataForm exposes the canonical metadata fields"
 *       MODIFIED Requirement "createRoute Server Action persists metadata + GPX-derived columns"
 *
 * Field-level rules after refactor-upload-metadata-fields: title (req), slug
 * (req, regex), description (opt, ≤5000), published (req bool). NO tags /
 * difficulty / duration_s / region (legacy keys are silently ignored).
 */

/** Minimal valid base object; spread + override per test. */
function base() {
  return {
    title: "淡水河左岸 LSD",
    slug: "tamsui-left-bank",
    published: true,
  };
}

describe("validateRouteMetadata", () => {
  describe("Scenario: Valid input returns ok", () => {
    it("returns ok with normalised value for fully valid input", () => {
      const result = validateRouteMetadata({
        title: "  淡水河左岸  ",
        slug: "tamsui",
        description: "  好跑的河濱路線  ",
        published: false,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          title: "淡水河左岸",
          slug: "tamsui",
          description: "好跑的河濱路線",
          published: false,
        },
      });
    });

    it("maps omitted optional fields to null defaults", () => {
      const result = validateRouteMetadata(base());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBeNull();
      }
    });

    it("normalised value does NOT contain tags / difficulty / duration_s / region", () => {
      const result = validateRouteMetadata(base());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect("tags" in result.value).toBe(false);
        expect("difficulty" in result.value).toBe(false);
        expect("duration_s" in result.value).toBe(false);
        expect("durationS" in result.value).toBe(false);
        expect("region" in result.value).toBe(false);
      }
    });
  });

  describe("Scenario: Invalid slug returns fieldErrors.slug", () => {
    it("rejects a slug with capital letters and spaces", () => {
      const result = validateRouteMetadata({ ...base(), slug: "Foo Bar" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.slug).toBeTruthy();
    });
  });

  describe("Scenario: Legacy fields are silently ignored", () => {
    it("ignores tags / difficulty / duration_s / region from older client payload", () => {
      const result = validateRouteMetadata({
        ...base(),
        tags: ["river", "lsd"],
        difficulty: "easy",
        duration_s: 1800,
        region: "台北",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect("tags" in result.value).toBe(false);
        expect("difficulty" in result.value).toBe(false);
        expect("duration_s" in result.value).toBe(false);
        expect("durationS" in result.value).toBe(false);
        expect("region" in result.value).toBe(false);
      }
    });

    it("does NOT emit fieldErrors for legacy keys", () => {
      const result = validateRouteMetadata({
        ...base(),
        tags: Array.from({ length: 999 }, (_, i) => `tag-${i}`),
        difficulty: "not-a-valid-level",
        duration_s: -5,
        region: "x".repeat(500),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        expect(result.fieldErrors.tags).toBeUndefined();
        expect(result.fieldErrors.difficulty).toBeUndefined();
        expect(result.fieldErrors.duration_s).toBeUndefined();
        expect(result.fieldErrors.region).toBeUndefined();
      }
    });
  });

  // ── Field-level rules retained ────────────────────────────────────────────

  describe("title rule", () => {
    it("accepts a trimmed non-empty title", () => {
      const result = validateRouteMetadata({ ...base(), title: "  abc  " });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.title).toBe("abc");
    });

    it("rejects whitespace-only title", () => {
      const result = validateRouteMetadata({ ...base(), title: "   " });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.title).toBeTruthy();
    });

    it("rejects title longer than 200 chars", () => {
      const result = validateRouteMetadata({ ...base(), title: "x".repeat(201) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.title).toBeTruthy();
    });

    it("rejects non-string title", () => {
      const result = validateRouteMetadata({ ...base(), title: 123 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.title).toBeTruthy();
    });
  });

  describe("slug rule", () => {
    it("accepts a valid lowercase-dash slug", () => {
      const result = validateRouteMetadata({ ...base(), slug: "abc-123" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.slug).toBe("abc-123");
    });

    it("rejects a slug with leading/trailing dash", () => {
      const result = validateRouteMetadata({ ...base(), slug: "-abc-" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.slug).toBeTruthy();
    });

    it("rejects empty slug", () => {
      const result = validateRouteMetadata({ ...base(), slug: "  " });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.slug).toBeTruthy();
    });

    it("rejects slug longer than 80 chars", () => {
      const result = validateRouteMetadata({ ...base(), slug: "a".repeat(81) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.slug).toBeTruthy();
    });
  });

  describe("description rule", () => {
    it("accepts an omitted description as null", () => {
      const result = validateRouteMetadata(base());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.description).toBeNull();
    });

    it("rejects description longer than 5000 chars", () => {
      const result = validateRouteMetadata({ ...base(), description: "x".repeat(5001) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.description).toBeTruthy();
    });
  });

  describe("published rule", () => {
    it("accepts boolean true and false", () => {
      for (const published of [true, false]) {
        const result = validateRouteMetadata({ ...base(), published });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.published).toBe(published);
      }
    });

    it("rejects a non-boolean published", () => {
      const result = validateRouteMetadata({ ...base(), published: "yes" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.published).toBeTruthy();
    });
  });

  describe("non-object input", () => {
    it("rejects a null input", () => {
      const result = validateRouteMetadata(null);
      expect(result.ok).toBe(false);
    });

    it("rejects an array input", () => {
      const result = validateRouteMetadata([]);
      expect(result.ok).toBe(false);
    });
  });
});
