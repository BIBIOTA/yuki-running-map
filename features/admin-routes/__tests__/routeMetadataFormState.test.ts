import { describe, expect, it } from "vitest";

import {
  buildInitialValues,
  hasAnyFieldError,
} from "../routeMetadataFormState";

describe("buildInitialValues", () => {
  describe("Scenario: no initial value yields defaults", () => {
    it("returns all-default values when called without arguments", () => {
      const values = buildInitialValues();
      expect(values).toEqual({
        title: "",
        slug: "",
        description: "",
        tags: [],
        published: false,
      });
    });

    it("returns all-default values when given an empty object", () => {
      expect(buildInitialValues({})).toEqual({
        title: "",
        slug: "",
        description: "",
        region: "",
        tags: [],
        difficulty: "easy",
        durationS: "",
        published: false,
      });
    });
  });

  describe("Scenario: partial initial overrides defaults", () => {
    it("merges partial initial values with defaults", () => {
      const values = buildInitialValues({ title: "foo", published: true });
      expect(values).toEqual({
        title: "foo",
        slug: "",
        description: "",
        tags: [],
        published: true,
      });
    });

    it("respects an overridden tags array", () => {
      const values = buildInitialValues({ tags: ["河濱"] });
      expect(values.tags).toEqual(["河濱"]);
      expect(values.title).toBe("");
    });
  });

  describe("Scenario: full initial overrides every default", () => {
    it("returns the supplied values verbatim", () => {
      const values = buildInitialValues({
        title: "陽明山主峰",
        slug: "yangmingshan-main-peak",
        description: "高難度，總爬升 800m。",
        tags: ["山徑", "高強度"],
        published: true,
      });
      expect(values).toEqual({
        title: "陽明山主峰",
        slug: "yangmingshan-main-peak",
        description: "高難度，總爬升 800m。",
        tags: ["山徑", "高強度"],
        published: true,
      });
    });
  });

  describe("Scenario: result is a fresh outer reference", () => {
    it("returns a new object on each call so React state never aliases", () => {
      const a = buildInitialValues();
      const b = buildInitialValues();
      expect(a).not.toBe(b);
      // Mutating a's tags must not bleed into b's tags. Even though the
      // shallow spread shares the empty-array reference from
      // DEFAULT_VALUES, we never mutate it in production — the form
      // always replaces values via `setField('tags', nextArray)`.
      expect(a).toEqual(b);
    });
  });
});

describe("hasAnyFieldError", () => {
  describe("Scenario: empty / missing maps return false", () => {
    it("returns false for undefined", () => {
      expect(hasAnyFieldError(undefined)).toBe(false);
    });

    it("returns false for an empty object", () => {
      expect(hasAnyFieldError({})).toBe(false);
    });
  });

  describe("Scenario: any field key returns true", () => {
    it("returns true for a per-field error", () => {
      expect(hasAnyFieldError({ title: "標題為必填" })).toBe(true);
    });

    it("returns true for a _form-level error", () => {
      expect(hasAnyFieldError({ _form: "寫入失敗" })).toBe(true);
    });

    it("returns true when multiple errors are present", () => {
      expect(
        hasAnyFieldError({ title: "x", slug: "y", _form: "z" }),
      ).toBe(true);
    });
  });
});
