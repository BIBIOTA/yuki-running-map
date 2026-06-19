/**
 * Client-side pre-flight checks for GPX file uploads in the admin UI.
 *
 * `validateGpxFile` runs in the browser BEFORE the file is read into a buffer
 * for preview parsing (see `lib/gpx/parseGpx`) and BEFORE it is sent to the
 * Server Action for Storage upload. It is a UX guard, not a security boundary —
 * the Server Action MUST re-validate (size + extension + parse) because a
 * motivated client can bypass any browser-side check.
 *
 * `derivePathFromUuid` produces the Supabase Storage object path the Server
 * Action uses when uploading the GPX file. Format: `gpx/{yyyy}/{uuid}.gpx`,
 * where `yyyy` is the UTC year from the supplied `Date`.
 */

/** Hard limit on uploaded GPX size — matches the literal in the acceptance spec. */
const MAX_GPX_BYTES = 10 * 1024 * 1024;

/** Required (case-insensitive) file extension for GPX uploads. */
const GPX_EXTENSION = ".gpx";

export type ValidateGpxFileResult = { ok: true } | { ok: false; message: string };

/**
 * Validate a GPX `File` selected via `<input type="file">` or a drag-and-drop
 * event. Checks extension first, then size — the order matches the acceptance
 * contract, so a 12 MB `.txt` file reports the extension error (the more
 * actionable feedback) rather than the size error.
 */
export function validateGpxFile(file: File): ValidateGpxFileResult {
  if (!hasGpxExtension(file.name)) {
    return { ok: false, message: "請選 .gpx 檔" };
  }
  if (file.size > MAX_GPX_BYTES) {
    return { ok: false, message: "檔案超過 10 MB" };
  }
  return { ok: true };
}

/**
 * Build the Supabase Storage object path for a freshly-generated route UUID.
 * The year is taken in UTC so that paths are stable regardless of server
 * timezone (Vercel functions and the developer's laptop may disagree).
 * The `uuid` is passed through verbatim — callers SHOULD supply a value from
 * `crypto.randomUUID()` so no escaping is required.
 */
export function derivePathFromUuid(date: Date, uuid: string): string {
  const year = date.getUTCFullYear();
  return `gpx/${year}/${uuid}.gpx`;
}

function hasGpxExtension(filename: string): boolean {
  return filename.toLowerCase().endsWith(GPX_EXTENSION);
}
