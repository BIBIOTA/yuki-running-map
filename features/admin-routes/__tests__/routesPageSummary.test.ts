import { describe, expect, it } from "vitest";

import { buildSummaryText, summarizeRoutes } from "../routesPageSummary";

describe("summarizeRoutes", () => {
  describe("Scenario: count routes by published state", () => {
    it("returns all-zero totals for an empty input", () => {
      expect(summarizeRoutes([])).toEqual({ total: 0, published: 0, draft: 0 });
    });

    it("splits mixed published/draft routes into the correct counts", () => {
      expect(
        summarizeRoutes([{ published: true }, { published: false }, { published: true }]),
      ).toEqual({ total: 3, published: 2, draft: 1 });
    });

    it("counts a lone draft as draft, not published", () => {
      expect(summarizeRoutes([{ published: false }])).toEqual({
        total: 1,
        published: 0,
        draft: 1,
      });
    });
  });
});

describe("buildSummaryText", () => {
  describe("Scenario: render `N 條 · X 已發佈 · Y 草稿` from a summary", () => {
    it("formats a populated summary with the load-bearing 繁中 separators", () => {
      expect(buildSummaryText({ total: 3, published: 2, draft: 1 })).toBe(
        "3 條 · 2 已發佈 · 1 草稿",
      );
    });

    it("formats a fully zero summary without falling back to a different string", () => {
      expect(buildSummaryText({ total: 0, published: 0, draft: 0 })).toBe(
        "0 條 · 0 已發佈 · 0 草稿",
      );
    });
  });
});
