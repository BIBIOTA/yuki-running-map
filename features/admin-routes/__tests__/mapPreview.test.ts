import { describe, expect, it } from "vitest";

import { bboxCenter, bboxToFitBoundsTuple } from "../mapPreview";

describe("bboxCenter", () => {
  it("returns the midpoint of a simple positive bbox", () => {
    expect(bboxCenter([0, 0, 10, 20])).toEqual([5, 10]);
  });

  it("returns the midpoint of a Taiwan-scale bbox", () => {
    expect(bboxCenter([121, 24, 122, 25])).toEqual([121.5, 24.5]);
  });

  it("returns the origin for a bbox symmetric about [0, 0]", () => {
    expect(bboxCenter([-1, -2, 1, 2])).toEqual([0, 0]);
  });
});

describe("bboxToFitBoundsTuple", () => {
  it("splits a Taiwan-scale bbox into [[sw], [ne]] tuples", () => {
    expect(bboxToFitBoundsTuple([121, 24, 122, 25])).toEqual([
      [121, 24],
      [122, 25],
    ]);
  });

  it("handles a zero-area bbox (single trackpoint) safely", () => {
    expect(bboxToFitBoundsTuple([0, 0, 0, 0])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
