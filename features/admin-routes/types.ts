/**
 * Shared types for the admin-routes feature.
 *
 * `RouteMetadataValues` is the form-state shape consumed by
 * `<RouteMetadataForm>`. It uses camelCase field names so it can map
 * 1:1 to `RouteMetadataInput`.
 */

export type RouteMetadataValues = {
  title: string;
  slug: string;
  description: string;
  published: boolean;
};
