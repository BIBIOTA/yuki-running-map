import { describe, expect, it } from "vitest";

import {
  buildInitialValues,
  hasAnyFieldError,
} from "../routeMetadataFormState";

describe("buildInitialValues", () => {
  describe("Form renders only the canonical fields", () => {
    it("returns all-default values when called without arguments", () => {
      const values = buildInitialValues();
      expect(values).toEqual({
        title: "",
        slug: "",
        description: "",
        published: false,
      });
    });

    it("returns all-default values when given an empty object", () => {
      expect(buildInitialValues({})).toEqual({
        title: "",
        slug: "",
        description: "",
        published: false,
      });
    });

    it("never includes a tags key", () => {
      expect("tags" in buildInitialValues()).toBe(false);
    });
  });

  describe("Scenario: partial initial overrides defaults", () => {
    it("merges partial initial values with defaults", () => {
      const values = buildInitialValues({ title: "foo", published: true });
      expect(values).toEqual({
        title: "foo",
        slug: "",
        description: "",
        published: true,
      });
    });
  });

  describe("Scenario: full initial overrides every default", () => {
    it("returns the supplied values verbatim", () => {
      const values = buildInitialValues({
        title: "陽明山主峰",
        slug: "yangmingshan-main-peak",
        description: "高難度，總爬升 800m。",
        published: true,
      });
      expect(values).toEqual({
        title: "陽明山主峰",
        slug: "yangmingshan-main-peak",
        description: "高難度，總爬升 800m。",
        published: true,
      });
    });
  });

  describe("Scenario: result is a fresh outer reference", () => {
    it("returns a new object on each call so React state never aliases", () => {
      const a = buildInitialValues();
      const b = buildInitialValues();
      expect(a).not.toBe(b);
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
