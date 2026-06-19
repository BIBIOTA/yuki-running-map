import { describe, expect, it } from "vitest";

import { addTag, filterSuggestions, removeTagAt } from "../tags";

describe("addTag", () => {
  describe("Scenario: appends a new tag", () => {
    it("returns a new array with the tag appended when empty", () => {
      expect(addTag([], "河濱")).toEqual(["河濱"]);
    });

    it("appends to a non-empty list", () => {
      expect(addTag(["河濱"], "LSD")).toEqual(["河濱", "LSD"]);
    });
  });

  describe("Scenario: deduplicates", () => {
    it("returns the same reference when the trimmed tag already exists", () => {
      const current = ["河濱"];
      const next = addTag(current, "河濱");
      expect(next).toBe(current);
    });

    it("trims whitespace before checking duplicates", () => {
      const current = ["河濱"];
      const next = addTag(current, "  河濱  ");
      expect(next).toBe(current);
    });
  });

  describe("Scenario: rejects empty input", () => {
    it("returns the same reference for an empty string", () => {
      const current: string[] = [];
      const next = addTag(current, "");
      expect(next).toBe(current);
    });

    it("returns the same reference for whitespace-only input", () => {
      const current: string[] = [];
      const next = addTag(current, "   ");
      expect(next).toBe(current);
    });
  });

  describe("Scenario: trims before insert", () => {
    it("stores the trimmed value when appending", () => {
      expect(addTag([], "  夜跑  ")).toEqual(["夜跑"]);
    });
  });
});

describe("removeTagAt", () => {
  describe("Scenario: removes the indexed element", () => {
    it("removes the middle element", () => {
      expect(removeTagAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    });

    it("removes the last element", () => {
      expect(removeTagAt(["a", "b"], 1)).toEqual(["a"]);
    });
  });

  describe("Scenario: out-of-range index is a no-op", () => {
    it("returns the same reference for an index past the end", () => {
      const current = ["a"];
      const next = removeTagAt(current, 5);
      expect(next).toBe(current);
    });

    it("returns the same reference for a negative index", () => {
      const current = ["a"];
      const next = removeTagAt(current, -1);
      expect(next).toBe(current);
    });

    it("returns the same reference for an empty array", () => {
      const current: string[] = [];
      const next = removeTagAt(current, 0);
      expect(next).toBe(current);
    });
  });
});

describe("filterSuggestions", () => {
  describe("Scenario: empty input shows no suggestions", () => {
    it("returns [] for an empty string", () => {
      expect(filterSuggestions(["河濱", "LSD", "夜跑"], [], "")).toEqual([]);
    });

    it("returns [] for whitespace-only input", () => {
      expect(filterSuggestions(["河濱", "LSD", "夜跑"], [], "   ")).toEqual([]);
    });
  });

  describe("Scenario: case-insensitive substring match", () => {
    it("matches a lowercased query against a mixed-case tag", () => {
      expect(filterSuggestions(["河濱", "LSD", "夜跑"], [], "lsd")).toEqual([
        "LSD",
      ]);
    });

    it("matches a partial Chinese substring", () => {
      expect(filterSuggestions(["河濱步道", "河濱公園", "山道"], [], "河濱"),
      ).toEqual(["河濱步道", "河濱公園"]);
    });
  });

  describe("Scenario: excludes already-selected tags", () => {
    it("hides tags already in current", () => {
      expect(filterSuggestions(["河濱", "LSD", "夜跑"], ["河濱"], "河")).toEqual(
        [],
      );
    });
  });

  describe("Scenario: caps result at 5", () => {
    it("returns at most 5 suggestions even when more match", () => {
      const existing = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
      const result = filterSuggestions(existing, [], "a");
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    });
  });

  describe("Scenario: no matches returns empty array", () => {
    it("returns [] when nothing matches", () => {
      expect(filterSuggestions(["河濱", "LSD"], [], "xyz")).toEqual([]);
    });
  });
});
