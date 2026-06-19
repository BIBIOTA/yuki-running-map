import { describe, expect, it } from "vitest";

import { deriveStateFromFile, formatFileSize } from "../dropzoneState";

/** Build a `File` of the requested byte size without allocating real content. */
function fileOfSize(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe("deriveStateFromFile", () => {
  describe("Scenario: Valid .gpx file passes", () => {
    it("returns { kind: 'valid', file } for a 1 MB .gpx file", () => {
      const file = fileOfSize("route.gpx", 1024 * 1024);
      const result = deriveStateFromFile(file);
      expect(result).toEqual({ kind: "valid", file });
    });

    it("accepts a file of exactly 10 MB (boundary)", () => {
      const file = fileOfSize("edge.gpx", 10 * 1024 * 1024);
      const result = deriveStateFromFile(file);
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.file).toBe(file);
      }
    });
  });

  describe("Scenario: Non-.gpx extension rejected", () => {
    it("returns the extension error for a .txt file", () => {
      const file = fileOfSize("notes.txt", 1024);
      expect(deriveStateFromFile(file)).toEqual({
        kind: "error",
        message: "請選 .gpx 檔",
      });
    });

    it("returns the extension error even when the file is also oversized", () => {
      const file = fileOfSize("huge.txt", 12 * 1024 * 1024);
      expect(deriveStateFromFile(file)).toEqual({
        kind: "error",
        message: "請選 .gpx 檔",
      });
    });
  });

  describe("Scenario: File larger than 10 MB rejected", () => {
    it("returns the size error for 10 MB + 1 byte", () => {
      const file = fileOfSize("over.gpx", 10 * 1024 * 1024 + 1);
      expect(deriveStateFromFile(file)).toEqual({
        kind: "error",
        message: "檔案超過 10 MB",
      });
    });

    it("returns the size error for an 11 MB .gpx file", () => {
      const file = fileOfSize("big.gpx", 11 * 1024 * 1024);
      expect(deriveStateFromFile(file)).toEqual({
        kind: "error",
        message: "檔案超過 10 MB",
      });
    });
  });
});

describe("formatFileSize", () => {
  describe("Scenario: bytes under 1 KB use byte unit", () => {
    it("formats 0 as '0 B'", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("formats 500 as '500 B'", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });
  });

  describe("Scenario: bytes in [1 KB, 1 MB) use KB unit", () => {
    it("formats 1024 as '1.0 KB'", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
    });

    it("formats 2048 as '2.0 KB'", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });
  });

  describe("Scenario: bytes ≥ 1 MB use MB unit", () => {
    it("formats 1 MB exactly", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    });

    it("formats 5 MB exactly", () => {
      expect(formatFileSize(1024 * 1024 * 5)).toBe("5.0 MB");
    });

    it("formats a fractional MB with one decimal", () => {
      // 1.5 MB
      expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe("1.5 MB");
    });
  });
});
