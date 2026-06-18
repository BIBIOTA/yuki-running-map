CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"distance_m" integer NOT NULL,
	"elevation_gain_m" integer NOT NULL,
	"duration_s" integer,
	"recorded_at" timestamp with time zone NOT NULL,
	"location_name" text,
	"region" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"gpx_path" text NOT NULL,
	"geojson" jsonb NOT NULL,
	"bbox" geometry(Polygon, 4326) NOT NULL,
	"start_point" geometry(Point, 4326) NOT NULL,
	"cover_image" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "routes_bbox_gist" ON "routes" USING gist ("bbox");--> statement-breakpoint
CREATE INDEX "routes_start_point_gist" ON "routes" USING gist ("start_point");--> statement-breakpoint
CREATE INDEX "routes_recorded_at_desc" ON "routes" USING btree ("recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "routes_tags_gin" ON "routes" USING gin ("tags");