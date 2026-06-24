import { describe, expect, it } from "vitest";

import {
  buildCreateRouteFormData,
  buildSuccessToastText,
} from "../uploadPageState";
import type { RouteMetadataValues } from "../types";

function makeFile(name = "track.gpx"): File {
  // The Action only cares that `gpxFile` is a `Blob` instance — a stub
  // GPX blob is enough to round-trip through the helper without
  // touching the real parser.
  return new File(["<gpx></gpx>"], name, { type: "application/gpx+xml" });
}

function makeValues(
  overrides: Partial<RouteMetadataValues> = {},
): RouteMetadataValues {
  return {
    title: "河濱晨跑",
    slug: "riverside-morning",
    description: "晨跑路線。",
    published: true,
    ...overrides,
  };
}

describe("buildCreateRouteFormData", () => {
  describe("Scenario: regular values produce the wire shape createRoute expects", () => {
    it("appends gpxFile as the supplied File", () => {
      const file = makeFile();
      const fd = buildCreateRouteFormData(makeValues(), file);
      const entry = fd.get("gpxFile");
      expect(entry).toBe(file);
    });

    it("appends title / slug / description as plain strings", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      expect(fd.get("title")).toBe("河濱晨跑");
      expect(fd.get("slug")).toBe("riverside-morning");
      expect(fd.get("description")).toBe("晨跑路線。");
    });

    it("appends published as the literal string 'true' when true", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ published: true }),
        makeFile(),
      );
      expect(fd.get("published")).toBe("true");
    });

    it("appends published as the literal string 'false' when false", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ published: false }),
        makeFile(),
      );
      expect(fd.get("published")).toBe("false");
    });

    it("does NOT emit legacy difficulty / duration_s / region / tags keys", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      expect(fd.has("difficulty")).toBe(false);
      expect(fd.has("duration_s")).toBe(false);
      expect(fd.has("durationS")).toBe(false);
      expect(fd.has("region")).toBe(false);
      expect(fd.has("tags")).toBe(false);
    });
  });

  describe("Scenario: boundary — empty optional strings round-trip as empty", () => {
    it("appends empty description as empty string, not null", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ description: "" }),
        makeFile(),
      );
      expect(fd.get("description")).toBe("");
    });
  });

  describe("Form FormData omits the tags entry", () => {
    it("emits the full key set with no duplicates and no tags", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      const keys = Array.from(fd.entries()).map(([k]) => k);
      expect(keys.sort()).toEqual(
        ["description", "gpxFile", "published", "slug", "title"].sort(),
      );
    });
  });
});

describe("buildSuccessToastText", () => {
  describe("Scenario: regular title", () => {
    it("wraps the title in full-width 「」 brackets after 已新增", () => {
      expect(buildSuccessToastText("河濱晨跑")).toBe("已新增「河濱晨跑」");
    });
  });

  describe("Scenario: boundary — empty title", () => {
    it("still produces a sensible string", () => {
      expect(buildSuccessToastText("")).toBe("已新增「」");
    });
  });
});
