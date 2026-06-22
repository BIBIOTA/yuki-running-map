-- admin_units + route_admin_units per
-- openspec/changes/feat-gpx-driven-route-metadata/design.md §3.3 / §3.4.
--
-- admin_units holds the Taiwan county + township MultiPolygon dataset
-- normalised by `scripts/build-admin-units-geojson.ts` and seeded by
-- migration 0007. It is intentionally readable by anonymous users
-- (public reference dataset; admin writes happen only at migration time).
--
-- route_admin_units is the join from routes to admin_units. ON DELETE
-- CASCADE on the route side keeps the join clean when admin deletes a
-- route; ON DELETE RESTRICT on the admin_unit side prevents an admin_unit
-- from disappearing while routes still reference it (an admin_units
-- refresh migration must wipe the join first).

CREATE TYPE "admin_level" AS ENUM ('county', 'township');--> statement-breakpoint

CREATE TABLE "admin_units" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code"        text UNIQUE NOT NULL,
  "level"       "admin_level" NOT NULL,
  "name"        text NOT NULL,
  "parent_code" text REFERENCES "admin_units" ("code") DEFERRABLE INITIALLY DEFERRED,
  "geom"        geometry(MultiPolygon, 4326) NOT NULL
);--> statement-breakpoint

CREATE INDEX "admin_units_geom_gist" ON "admin_units" USING GIST ("geom");--> statement-breakpoint
CREATE INDEX "admin_units_level_idx" ON "admin_units" ("level");--> statement-breakpoint

CREATE TABLE "route_admin_units" (
  "route_id"      uuid NOT NULL REFERENCES "routes" ("id") ON DELETE CASCADE,
  "admin_unit_id" uuid NOT NULL REFERENCES "admin_units" ("id") ON DELETE RESTRICT,
  PRIMARY KEY ("route_id", "admin_unit_id")
);--> statement-breakpoint

CREATE INDEX "route_admin_units_admin_unit_idx" ON "route_admin_units" ("admin_unit_id");--> statement-breakpoint

-- RLS — admin_units is public reference data.
ALTER TABLE "admin_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "anon_read_admin_units" ON "admin_units"
  FOR SELECT
  USING (true);--> statement-breakpoint

-- RLS — route_admin_units mirrors the routes table's anon SELECT gate
-- (only rows whose route is published are visible to anonymous users).
ALTER TABLE "route_admin_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "anon_read_published_route_admin_units" ON "route_admin_units"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "routes" r
      WHERE r.id = "route_admin_units"."route_id"
        AND r.published = true
    )
  );--> statement-breakpoint

-- Admin full access mirrors the routes admin policy (uses the same
-- app_admin_github_username() function established in 0001).
CREATE POLICY "admin_full_access_route_admin_units" ON "route_admin_units"
  FOR ALL
  USING (
    (auth.jwt()->'user_metadata'->>'user_name') = public.app_admin_github_username()
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'user_name') = public.app_admin_github_username()
  );
