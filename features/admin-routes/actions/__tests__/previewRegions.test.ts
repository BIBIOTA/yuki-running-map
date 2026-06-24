/**
 * Unit tests for the `previewRegions` Server Action.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/route-administrative-regions/spec.md
 *       Requirement "previewRegions read-only Server Action returns Region[] from a LineString"
 *
 * Scenarios covered:
 *   - "Valid LineString returns the matching regions"
 *   - "detectRegions throwing surfaces as a tagged error"
 *   - "Malformed geometry input is rejected"
 *
 * The Action is server-only; we mock `getDb` and `detectRegions` so the
 * Action's pure orchestration (validate input → call helper → join lookup
 * → fold errors into the discriminated return) is exercised without a
 * live Postgres.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/admin-routes/detectRegions", () => ({
  detectRegions: vi.fn(),
}));

import { detectRegions } from "@/lib/admin-routes/detectRegions";
import { getDb } from "@/lib/db/client";

import { previewRegions } from "../previewRegions";

const mockGetDb = vi.mocked(getDb);
const mockDetect = vi.mocked(detectRegions);

const VALID_LS = {
  type: "LineString" as const,
  coordinates: [
    [121.515, 25.04],
    [121.535, 25.04],
  ] satisfies Array<[number, number]>,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("previewRegions", () => {
  it("Valid LineString returns the matching regions", async () => {
    const fakeSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            code: "65000",
            level: "county",
            name: "新北市",
            parent_code: null,
          },
          {
            code: "65000010",
            level: "township",
            name: "新店區",
            parent_code: "65000",
          },
        ]),
      }),
    });
    mockGetDb.mockReturnValue({ select: fakeSelect } as never);
    mockDetect.mockResolvedValue([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);

    const result = await previewRegions(VALID_LS);

    expect(result).toEqual({
      ok: true,
      regions: [
        { code: "65000", level: "county", name: "新北市", parent_code: null },
        {
          code: "65000010",
          level: "township",
          name: "新店區",
          parent_code: "65000",
        },
      ],
    });
    expect(mockDetect).toHaveBeenCalledTimes(1);
    expect(mockDetect).toHaveBeenCalledWith(expect.anything(), VALID_LS);
  });

  it("detectRegions throwing surfaces as a tagged error", async () => {
    mockGetDb.mockReturnValue({ select: vi.fn() } as never);
    mockDetect.mockRejectedValue(new Error("PostGIS boom"));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await previewRegions(VALID_LS);
    errSpy.mockRestore();

    expect(result).toEqual({
      ok: false,
      message: "行政區預覽暫時無法使用",
    });
  });

  it("Malformed geometry input is rejected", async () => {
    const badInputs: Array<unknown> = [
      null,
      undefined,
      { type: "Point", coordinates: [121, 25] },
      { type: "LineString" },
      { type: "LineString", coordinates: [] },
      { type: "LineString", coordinates: [[121, 25]] }, // < 2 points
      { type: "LineString", coordinates: [[121], [122]] }, // missing lat
    ];

    for (const input of badInputs) {
      const result = await previewRegions(
        input as Parameters<typeof previewRegions>[0],
      );
      expect(result).toEqual({ ok: false, message: "預覽參數錯誤" });
    }

    expect(mockDetect).not.toHaveBeenCalled();
  });
});
