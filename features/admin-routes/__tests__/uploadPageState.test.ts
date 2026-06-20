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
    region: "台北市",
    tags: ["河濱", "LSD"],
    difficulty: "medium",
    durationS: "3600",
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

    it("appends title / slug / description / region / difficulty as plain strings", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      expect(fd.get("title")).toBe("河濱晨跑");
      expect(fd.get("slug")).toBe("riverside-morning");
      expect(fd.get("description")).toBe("晨跑路線。");
      expect(fd.get("region")).toBe("台北市");
      expect(fd.get("difficulty")).toBe("medium");
    });

    it("appends tags as a JSON-stringified array", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      const tagsRaw = fd.get("tags");
      expect(typeof tagsRaw).toBe("string");
      expect(JSON.parse(tagsRaw as string)).toEqual(["河濱", "LSD"]);
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

    it("renames the camelCase durationS field to snake_case duration_s", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ durationS: "5400" }),
        makeFile(),
      );
      expect(fd.get("duration_s")).toBe("5400");
      // The Action reads `duration_s` exclusively — `durationS` must NOT
      // leak through, otherwise the value would be silently dropped and
      // the route would be inserted with a null duration.
      expect(fd.get("durationS")).toBeNull();
    });
  });

  describe("Scenario: boundary — empty optional strings round-trip as empty", () => {
    it("appends empty description / region as empty strings, not null", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ description: "", region: "" }),
        makeFile(),
      );
      // FormData.get returns the appended value verbatim; the Action's
      // `formString` helper trims/keeps these as-is.
      expect(fd.get("description")).toBe("");
      expect(fd.get("region")).toBe("");
    });

    it("appends an empty tags array as the JSON literal '[]'", () => {
      const fd = buildCreateRouteFormData(makeValues({ tags: [] }), makeFile());
      expect(fd.get("tags")).toBe("[]");
    });

    it("appends an empty durationS as the empty string", () => {
      const fd = buildCreateRouteFormData(
        makeValues({ durationS: "" }),
        makeFile(),
      );
      expect(fd.get("duration_s")).toBe("");
    });
  });

  describe("Scenario: every contract key is present exactly once", () => {
    it("emits the full key set with no duplicates", () => {
      const fd = buildCreateRouteFormData(makeValues(), makeFile());
      const keys = Array.from(fd.entries()).map(([k]) => k);
      expect(keys.sort()).toEqual(
        [
          "description",
          "difficulty",
          "duration_s",
          "gpxFile",
          "published",
          "region",
          "slug",
          "tags",
          "title",
        ].sort(),
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
