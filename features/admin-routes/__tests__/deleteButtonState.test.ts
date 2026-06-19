import { describe, expect, it } from "vitest";

import { buildConfirmBody, buildSuccessToast } from "../deleteButtonState";

describe("buildConfirmBody", () => {
  describe("Scenario: title only (no gpxPath)", () => {
    it("renders the short fallback with the title in 「」 brackets", () => {
      expect(buildConfirmBody("河濱晨跑")).toBe("將永久刪除「河濱晨跑」（含 GPX 原檔）。");
    });

    it("treats an undefined gpxPath the same as omitted", () => {
      expect(buildConfirmBody("河濱晨跑", undefined)).toBe(
        "將永久刪除「河濱晨跑」（含 GPX 原檔）。",
      );
    });
  });

  describe("Scenario: title + gpxPath", () => {
    it("renders the storage path in 半形 parentheses after the title", () => {
      expect(buildConfirmBody("河濱晨跑", "gpx/2026/abc.gpx")).toBe(
        "將永久刪除「河濱晨跑」，含 GPX 原檔（gpx/2026/abc.gpx）。",
      );
    });

    it("respects a nested storage path verbatim", () => {
      expect(buildConfirmBody("陽明山主峰", "gpx/2026/06/yangmingshan.gpx")).toBe(
        "將永久刪除「陽明山主峰」，含 GPX 原檔（gpx/2026/06/yangmingshan.gpx）。",
      );
    });
  });

  describe("Scenario: boundary — empty title", () => {
    it("produces a sensible string without throwing when title is empty", () => {
      expect(buildConfirmBody("")).toBe("將永久刪除「」（含 GPX 原檔）。");
    });

    it("produces a sensible string when both title and gpxPath are empty", () => {
      // gpxPath === "" is falsy → short fallback branch
      expect(buildConfirmBody("", "")).toBe("將永久刪除「」（含 GPX 原檔）。");
    });
  });
});

describe("buildSuccessToast", () => {
  describe("Scenario: regular title", () => {
    it("wraps the title in full-width 「」 brackets after 已刪除", () => {
      expect(buildSuccessToast("河濱晨跑")).toBe("已刪除「河濱晨跑」");
    });
  });

  describe("Scenario: boundary — empty title", () => {
    it("still produces a sensible string", () => {
      expect(buildSuccessToast("")).toBe("已刪除「」");
    });
  });
});
