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
    elevationProfile: [],
    recordedAt: new Date("2025-01-15T06:00:00Z"),
    locationName: null,
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
    published: true,
    ...overrides,
  };
}

describe("buildFormInitialFromRoute", () => {
  describe("Scenario: full route row maps to form-state shape", () => {
    it("preserves title / slug / published verbatim", () => {
      const out = buildFormInitialFromRoute(makeRoute());
      expect(out.title).toBe("河濱晨跑");
      expect(out.slug).toBe("riverside-morning");
      expect(out.published).toBe(true);
    });

    it("never includes a tags key", () => {
      expect("tags" in buildFormInitialFromRoute(makeRoute())).toBe(false);
    });
  });

  describe("Scenario: boundary — nullable columns become empty strings", () => {
    it("maps null description to empty string", () => {
      const out = buildFormInitialFromRoute(makeRoute({ description: null }));
      expect(out.description).toBe("");
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
    it("merges the id and passes scalars through", () => {
      const out = buildUpdateRoutePayload("id-1", makeValues());
      expect(out).toEqual({
        id: "id-1",
        title: "河濱晨跑",
        slug: "riverside-morning",
        description: "晨跑路線。",
        published: true,
      });
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
  });

  describe("Scenario: passthroughs", () => {
    it("preserves a false published flag", () => {
      const out = buildUpdateRoutePayload(
        "id-1",
        makeValues({ published: false }),
      );
      expect(out.published).toBe(false);
    });
  });

  describe("Scenario: legacy keys are not emitted", () => {
    it("payload does NOT contain difficulty / duration_s / region / tags", () => {
      const out = buildUpdateRoutePayload("id-1", makeValues());
      expect("difficulty" in out).toBe(false);
      expect("duration_s" in out).toBe(false);
      expect("durationS" in out).toBe(false);
      expect("region" in out).toBe(false);
      expect("tags" in out).toBe(false);
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
