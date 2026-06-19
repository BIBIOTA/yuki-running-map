/**
 * Shared types for the admin-routes feature.
 *
 * `Difficulty` mirrors the database enum (`lib/db/schema.ts`) and the
 * `RouteMetadataInput` discriminator in `lib/admin-routes/validation.ts`.
 *
 * `RouteMetadataValues` is the form-state shape consumed by
 * `<RouteMetadataForm>`. It uses camelCase field names so it can map
 * 1:1 to `RouteMetadataInput`; `durationS` is a string here (rather
 * than `number | null`) because it is bound directly to a numeric
 * `<Input>` and parsed by the caller before submission.
 */

export type Difficulty = "easy" | "medium" | "hard";

export type RouteMetadataValues = {
  title: string;
  slug: string;
  description: string;
  region: string;
  tags: string[];
  difficulty: Difficulty;
  durationS: string;
  published: boolean;
};
