import { describe, expect, it } from "vitest";

import { derivePathFromUuid, validateGpxFile } from "../gpxFile";

/** Build a `File` of the requested byte size without allocating real content. */
function fileOfSize(name: string, size: number): File {
  // A single Uint8Array of the requested length is the simplest cross-runtime
  // approach (Node and JSDOM both implement `File` over `Blob`).
  return new File([new Uint8Array(size)], name);
}

describe("validateGpxFile", () => {
  describe("Scenario: Valid .gpx file passes", () => {
    it("returns { ok: true } for a small .gpx file", () => {
      const file = fileOfSize("route.gpx", 1_024);
      expect(validateGpxFile(file)).toEqual({ ok: true });
    });

    it("accepts uppercase .GPX extension (case-insensitive)", () => {
      const file = fileOfSize("ROUTE.GPX", 1_024);
      expect(validateGpxFile(file)).toEqual({ ok: true });
    });

    it("accepts a file of exactly 10 MB (boundary)", () => {
      const file = fileOfSize("big.gpx", 10 * 1024 * 1024);
      expect(validateGpxFile(file)).toEqual({ ok: true });
    });
  });

  describe("Scenario: Non-.gpx extension rejected", () => {
    it("returns the extension error for a .txt file", () => {
      const file = fileOfSize("route.txt", 1_024);
      expect(validateGpxFile(file)).toEqual({
        ok: false,
        message: "請選 .gpx 檔",
      });
    });

    it("reports the extension error first when both checks would fail", () => {
      // 12 MB .txt → extension error wins per spec ordering.
      const file = fileOfSize("huge.txt", 12 * 1024 * 1024);
      expect(validateGpxFile(file)).toEqual({
        ok: false,
        message: "請選 .gpx 檔",
      });
    });
  });

  describe("Scenario: File larger than 10 MB rejected", () => {
    it("returns the size error for 10 MB + 1 byte", () => {
      const file = fileOfSize("over.gpx", 10 * 1024 * 1024 + 1);
      expect(validateGpxFile(file)).toEqual({
        ok: false,
        message: "檔案超過 10 MB",
      });
    });
  });
});

describe("derivePathFromUuid", () => {
  it("returns gpx/2026/abc-123.gpx for the spec example", () => {
    expect(derivePathFromUuid(new Date("2026-06-19"), "abc-123")).toBe(
      "gpx/2026/abc-123.gpx",
    );
  });

  it("derives the year dynamically from the supplied date", () => {
    expect(derivePathFromUuid(new Date("2025-01-01T00:00:00Z"), "uuid-2025")).toBe(
      "gpx/2025/uuid-2025.gpx",
    );
  });

  it("uses UTC year so timezone shifts do not bleed into the path", () => {
    // 2026-01-01T00:30:00Z is still 2026 in UTC even if the host is UTC-1.
    expect(
      derivePathFromUuid(new Date("2026-01-01T00:30:00Z"), "edge-uuid"),
    ).toBe("gpx/2026/edge-uuid.gpx");
  });
});
