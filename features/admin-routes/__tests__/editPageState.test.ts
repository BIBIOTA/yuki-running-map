import { describe, expect, it } from "vitest";

import {
  buildFormInitialFromRoute,
  buildUpdateRoutePayload,
  countTrackpoints,
  formatDistance,
  formatElevation,
} from "../editPageState";
import type { RouteMetadataValues } from "../types";
import type { Route } from "@/lib/db/schema";

function makeRoute(overrides: Partial<Route> = {}): Route {
  // Minimal Route stub — only the fields read by
  // `buildFormInitialFromRoute` need to be realistic; everything
  // else satisfies the structural type for the test.
  const base: Route = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "riverside-morning",
    title: "河濱晨跑",
    description: "晨跑路線。",
    distanceM: 5200,
    elevationGainM: 42,
    durationS: 1800,
    recordedAt: new Date("2025-01-15T06:00:00Z"),
    locationName: null,
    region: "台北市",
    tags: ["河濱", "LSD"],
    difficulty: "medium",
    gpxPath: "routes/abc.gpx",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [[121, 25]] },
    },
    bbox: {} as Route["bbox"],
    startPoint: {} as Route["startPoint"],
    coverImage: null,
    published: true,
    createdAt: new Date("2025-01-15T07:00:00Z"),
    updatedAt: new Date("2025-01-15T07:00:00Z"),
  };
  return { ...base, ...overrides };
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
    durationS: "1800",
    published: true,
    ...overrides,
  };
}

describe("buildFormInitialFromRoute", () => {
  describe("Scenario: full route row maps to form-state shape", () => {
    it("preserves title / slug / tags / difficulty / published verbatim", () => {
      const out = buildFormInitialFromRoute(makeRoute());
      expect(out.title).toBe("河濱晨跑");
      expect(out.slug).toBe("riverside-morning");
      expect(out.tags).toEqual(["河濱", "LSD"]);
      expect(out.difficulty).toBe("medium");
      expect(out.published).toBe(true);
    });

    it("stringifies a numeric durationS", () => {
      const out = buildFormInitialFromRoute(makeRoute({ durationS: 3600 }));
      expect(out.durationS).toBe("3600");
    });
  });

  describe("Scenario: boundary — nullable columns become empty strings", () => {
    it("maps null description to empty string", () => {
      const out = buildFormInitialFromRoute(makeRoute({ description: null }));
      expect(out.description).toBe("");
    });

    it("maps null region to empty string", () => {
      const out = buildFormInitialFromRoute(makeRoute({ region: null }));
      expect(out.region).toBe("");
    });

    it("maps null durationS to empty string", () => {
      const out = buildFormInitialFromRoute(makeRoute({ durationS: null }));
      expect(out.durationS).toBe("");
    });
  });

  describe("Scenario: published=false propagates", () => {
    it("preserves a false published flag", () => {
      const out = buildFormInitialFromRoute(makeRoute({ published: false }));
      expect(out.published).toBe(false);
    });
  });
});

describe("buildUpdateRoutePayload", () => {
  describe("Scenario: regular values produce the wire shape updateRoute expects", () => {
    it("merges the id, parses duration_s, and passes scalars through", () => {
      const out = buildUpdateRoutePayload("id-1", makeValues());
      expect(out).toEqual({
        id: "id-1",
        title: "河濱晨跑",
        slug: "riverside-morning",
        description: "晨跑路線。",
        region: "台北市",
        tags: ["河濱", "LSD"],
        difficulty: "medium",
        duration_s: 1800,
        published: true,
      });
    });

    it("renames camelCase durationS to snake_case duration_s", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ durationS: "120" }),
      );
      expect(out.duration_s).toBe(120);
      // `durationS` must NOT leak through, otherwise the validator would
      // accept the row with a null duration silently.
      expect((out as Record<string, unknown>).durationS).toBeUndefined();
    });
  });

  describe("Scenario: durationS edge cases fold to null", () => {
    it("maps empty durationS to null", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ durationS: "" }),
      );
      expect(out.duration_s).toBeNull();
    });

    it("maps NaN durationS to null", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ durationS: "abc" }),
      );
      expect(out.duration_s).toBeNull();
    });

    it("maps whitespace-only durationS to null", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ durationS: "   " }),
      );
      expect(out.duration_s).toBeNull();
    });
  });

  describe("Scenario: optional strings trim and fold to null when empty", () => {
    it("maps empty description to null", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ description: "" }),
      );
      expect(out.description).toBeNull();
    });

    it("trims surrounding whitespace on description", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ description: "  hello  " }),
      );
      expect(out.description).toBe("hello");
    });

    it("maps whitespace-only description to null", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ description: "   " }),
      );
      expect(out.description).toBeNull();
    });

    it("maps empty region to null", () => {
      const out = buildUpdateRoutePayload("id-1", makeValues({ region: "" }));
      expect(out.region).toBeNull();
    });

    it("trims surrounding whitespace on region", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ region: "  台北市  " }),
      );
      expect(out.region).toBe("台北市");
    });
  });

  describe("Scenario: passthroughs", () => {
    it("preserves an empty tags array", () => {
      const out = buildUpdateRoutePayload("id-1", makeValues({ tags: [] }));
      expect(out.tags).toEqual([]);
    });

    it("preserves a false published flag", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ published: false }),
      );
      expect(out.published).toBe(false);
    });
  });
});

describe("formatDistance", () => {
  it("formats metres as km with two decimal places", () => {
    expect(formatDistance(1234)).toBe("1.23 km");
  });

  it("formats zero as '0.00 km'", () => {
    expect(formatDistance(0)).toBe("0.00 km");
  });

  it("formats 10500 metres as '10.50 km'", () => {
    expect(formatDistance(10500)).toBe("10.50 km");
  });
});

describe("formatElevation", () => {
  it("appends ' m' to integer metres", () => {
    expect(formatElevation(150)).toBe("150 m");
  });

  it("formats zero elevation as '0 m'", () => {
    expect(formatElevation(0)).toBe("0 m");
  });
});

describe("countTrackpoints", () => {
  it("counts coordinates on a Feature<LineString>", () => {
    expect(
      countTrackpoints({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [1, 2],
            [3, 4],
          ],
        },
      }),
    ).toBe(2);
  });

  it("returns 0 for null", () => {
    expect(countTrackpoints(null)).toBe(0);
  });

  it("returns 0 for an empty object", () => {
    expect(countTrackpoints({})).toBe(0);
  });

  it("returns 0 when coordinates is missing", () => {
    expect(countTrackpoints({ geometry: {} })).toBe(0);
  });

  it("returns 0 for an empty coordinates array", () => {
    expect(countTrackpoints({ geometry: { coordinates: [] } })).toBe(0);
  });

  it("returns 0 when geojson is a string", () => {
    expect(countTrackpoints("not a geojson")).toBe(0);
  });
});
