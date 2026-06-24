/**
 * Field-level validation for admin route metadata.
 *
 * `validateRouteMetadata` takes an untrusted structured object (the calling
 * Server Action is responsible for coercing FormData into this shape) and
 * returns a discriminated union: either the normalised value or a map of
 * per-field error messages. Error messages are in 繁體中文 because they are
 * surfaced directly in the admin UI.
 */

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Normalised metadata shape; field names match `lib/db/schema.ts`. */
export interface RouteMetadataInput {
  title: string;
  slug: string;
  description: string | null;
  published: boolean;
}

export type ValidateRouteMetadataResult =
  | { ok: true; value: RouteMetadataInput }
  | { ok: false; fieldErrors: Record<string, string> };

const TITLE_MAX = 200;
const SLUG_MAX = 80;
const DESCRIPTION_MAX = 5000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRouteMetadata(input: unknown): ValidateRouteMetadataResult {
  const fieldErrors: Record<string, string> = {};

  if (!isPlainObject(input)) {
    return { ok: false, fieldErrors: { _form: "輸入格式不正確" } };
  }

  // title — required, trim length 1..200
  let title = "";
  if (typeof input.title !== "string") {
    fieldErrors.title = "標題為必填";
  } else {
    title = input.title.trim();
    if (title.length < 1) {
      fieldErrors.title = "標題為必填";
    } else if (title.length > TITLE_MAX) {
      fieldErrors.title = `標題長度不可超過 ${TITLE_MAX} 字`;
    }
  }

  // slug — required, regex, length <= 80
  let slug = "";
  if (typeof input.slug !== "string") {
    fieldErrors.slug = "網址代稱為必填";
  } else {
    slug = input.slug.trim();
    if (slug.length < 1) {
      fieldErrors.slug = "網址代稱為必填";
    } else if (slug.length > SLUG_MAX) {
      fieldErrors.slug = `網址代稱長度不可超過 ${SLUG_MAX} 字`;
    } else if (!SLUG_REGEX.test(slug)) {
      fieldErrors.slug = "網址代稱格式不正確（僅小寫字母、數字、連字號）";
    }
  }

  // description — optional, length <= 5000
  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      fieldErrors.description = "描述格式不正確";
    } else {
      const trimmed = input.description.trim();
      if (trimmed.length > DESCRIPTION_MAX) {
        fieldErrors.description = `描述長度不可超過 ${DESCRIPTION_MAX} 字`;
      } else {
        description = trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  // Legacy keys (tags / difficulty / duration_s / region) are silently
  // ignored. They were removed by feat-gpx-driven-route-metadata and
  // refactor-upload-metadata-fields respectively; an older client that
  // still sends them produces no validation error and no field on the
  // normalised output.

  // published — required boolean
  let published = false;
  if (typeof input.published !== "boolean") {
    fieldErrors.published = "發布狀態必須為布林值";
  } else {
    published = input.published;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: { title, slug, description, published },
  };
}
