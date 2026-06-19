import { describe, expect, it } from "vitest";

import { validateRouteMetadata } from "../validation";

/** Minimal valid base object; spread + override per test. */
function base() {
  return {
    title: "淡水河左岸 LSD",
    slug: "tamsui-left-bank",
    difficulty: "medium" as const,
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
        region: "  新北市  ",
        tags: ["河濱", " 河濱 ", "", "LSD"],
        difficulty: "easy",
        duration_s: 3600,
        published: false,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          title: "淡水河左岸",
          slug: "tamsui",
          description: "好跑的河濱路線",
          region: "新北市",
          tags: ["河濱", "LSD"],
          difficulty: "easy",
          durationS: 3600,
          published: false,
        },
      });
    });

    it("maps omitted optional fields to null/empty defaults", () => {
      const result = validateRouteMetadata(base());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBeNull();
        expect(result.value.region).toBeNull();
        expect(result.value.tags).toEqual([]);
        expect(result.value.durationS).toBeNull();
      }
    });
  });

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

    describe("Scenario: Invalid slug returns fieldErrors.slug", () => {
      it("rejects a slug with capital letters and spaces", () => {
        const result = validateRouteMetadata({ ...base(), slug: "Foo Bar" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.fieldErrors.slug).toBeTruthy();
      });
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

  describe("region rule", () => {
    it("accepts a trimmed region", () => {
      const result = validateRouteMetadata({ ...base(), region: "  台北  " });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.region).toBe("台北");
    });

    it("rejects region longer than 50 chars", () => {
      const result = validateRouteMetadata({ ...base(), region: "x".repeat(51) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.region).toBeTruthy();
    });
  });

  describe("tags rule", () => {
    describe("Scenario: Tag deduplication and trimming", () => {
      it("trims, drops empty, and dedupes tags", () => {
        const result = validateRouteMetadata({
          ...base(),
          tags: ["河濱", " 河濱 ", "", "LSD"],
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.tags).toEqual(["河濱", "LSD"]);
      });
    });

    it("rejects more than 20 tags", () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
      const result = validateRouteMetadata({ ...base(), tags });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.tags).toBeTruthy();
    });

    it("rejects a tag longer than 30 chars", () => {
      const result = validateRouteMetadata({ ...base(), tags: ["x".repeat(31)] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.tags).toBeTruthy();
    });

    it("rejects non-string tag elements", () => {
      const result = validateRouteMetadata({ ...base(), tags: ["ok", 123] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.tags).toBeTruthy();
    });
  });

  describe("difficulty rule", () => {
    it("accepts each enum value", () => {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const result = validateRouteMetadata({ ...base(), difficulty });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.difficulty).toBe(difficulty);
      }
    });

    it("rejects an out-of-enum value", () => {
      const result = validateRouteMetadata({ ...base(), difficulty: "extreme" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.difficulty).toBeTruthy();
    });

    it("rejects a missing difficulty", () => {
      const { difficulty: _omit, ...rest } = base();
      void _omit;
      const result = validateRouteMetadata(rest);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.difficulty).toBeTruthy();
    });
  });

  describe("duration_s rule", () => {
    it("accepts a positive integer", () => {
      const result = validateRouteMetadata({ ...base(), duration_s: 120 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.durationS).toBe(120);
    });

    it("rejects zero / negative", () => {
      const result = validateRouteMetadata({ ...base(), duration_s: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.duration_s).toBeTruthy();
    });

    it("rejects a non-integer", () => {
      const result = validateRouteMetadata({ ...base(), duration_s: 12.5 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.duration_s).toBeTruthy();
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
