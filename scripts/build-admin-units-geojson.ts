/**
 * Dev-side tool: ingest a raw Taiwan admin-unit GeoJSON (county + township
 * data from data.gov.tw) and write a normalised FeatureCollection that
 * migration 0007 can `\copy` into the `admin_units` table.
 *
 * Usage:
 *   pnpm tsx scripts/build-admin-units-geojson.ts <input.geojson> [output.geojson]
 *
 * The default output path is `lib/db/migrations/seed/taiwan-admin-units.geojson`.
 * The script does NOT touch the database — it is a pure transformation tool.
 * `ST_MakeValid` polygon repair runs DB-side at insert time (migration 0007),
 * not here.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       "seed migration imports Taiwan admin units from GeoJSON"
 * Runbook: docs/runbooks/admin-units-refresh.md (for the year-over-year
 *          refresh workflow).
 *
 * Trade-off: the design.md inventory references SHP source data. Adding a
 * SHP parser would require a new npm dep (against CLAUDE.md), and
 * data.gov.tw publishes the same boundary data in GeoJSON. This script
 * therefore consumes GeoJSON; the runbook documents which dataset to grab.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeAdminUnits } from "@/lib/regions/normalizeAdminUnits";

function main(): void {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    process.stderr.write(
      "usage: build-admin-units-geojson.ts <input.geojson> [output.geojson]\n",
    );
    process.exit(1);
  }

  const inputPath = resolve(inputArg);
  const outputPath = resolve(
    outputArg ?? "lib/db/migrations/seed/taiwan-admin-units.geojson",
  );

  const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
  const normalised = normalizeAdminUnits(raw);

  writeFileSync(outputPath, JSON.stringify(normalised, null, 2) + "\n");
  process.stdout.write(
    `Wrote ${normalised.features.length} features to ${outputPath}\n`,
  );
}

main();
