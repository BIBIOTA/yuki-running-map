/**
 * Pure state-derivation helpers for `<GpxDropzone>` (see `./GpxDropzone.tsx`).
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §3.2 and
 *       openspec/changes/feat-admin-gpx-upload/specs/admin-routes/spec.md:171.
 *
 * The Component delegates all decisions about "is this drop valid?" and
 * "how do I render the size in the loaded chip?" to functions in this
 * module so they can be unit-tested in the node-only vitest environment
 * (no React testing library, per CLAUDE.md). The Component itself stays
 * a thin shell of useState + event handlers and is exercised end-to-end
 * by the Playwright spec in task 5.1.
 */

import { validateGpxFile } from "@/lib/admin-routes/gpxFile";

/**
 * Result of running the client-side pre-flight checks on a single dropped
 * or picked `File`. Mirrors the discriminated-union shape `validateGpxFile`
 * already returns, but renamed (`valid`/`error`) so the call site reads
 * cleanly inside the Component's `setState` branches.
 */
export type DeriveStateResult =
  | { kind: "valid"; file: File }
  | { kind: "error"; message: string };

/**
 * Run the extension + size guard from `validateGpxFile` against the supplied
 * `File`. The returned discriminated union lets the Component pick between
 * "advance to parsing" and "render error state" without re-reading the
 * raw `validateGpxFile` boolean.
 *
 * The error messages are forwarded verbatim from `validateGpxFile` so the
 * exact strings («請選 .gpx 檔», «檔案超過 10 MB») stay in one place.
 */
export function deriveStateFromFile(file: File): DeriveStateResult {
  const result = validateGpxFile(file);
  if (result.ok) {
    return { kind: "valid", file };
  }
  return { kind: "error", message: result.message };
}

/**
 * Format a byte count for the loaded-state chip ("route.gpx · 1.2 MB").
 *
 * Uses binary (1024-based) units to match the size guard in
 * `validateGpxFile` (which counts against `10 * 1024 * 1024` bytes).
 * Returns one fractional digit for KB / MB so a 1 MB file reads as
 * `"1.0 MB"`, not `"1 MB"`.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
