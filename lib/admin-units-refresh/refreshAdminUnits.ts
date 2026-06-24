/**
 * Refresh-admin-units pipeline.
 *
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *       Requirement "refresh-admin-units convenience wrapper script"
 *
 * Pure orchestrator. All IO is injected via `deps` so the same code path
 * is exercised by:
 *   - vitest (mocks for fetch / writeFile / stdout / stderr / processExit)
 *   - the CLI entry in scripts/refresh-admin-units.ts (real implementations)
 *
 * Design note: g0v's twgeojson mirror ships counties + townships as two
 * separate FeatureCollections. We fetch both, merge into one, normalise
 * via the shared helper (which already accepts COUNTYSN/TOWNSN), and
 * write the result to the seed path the migration consumes.
 */

import { normalizeAdminUnits } from "@/lib/regions/normalizeAdminUnits";

export const COUNTY_URL =
  "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json";
export const TOWN_URL =
  "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twTown1982.geo.json";

export const DEFAULT_SEED_PATH =
  "lib/db/migrations/seed/taiwan-admin-units.geojson";

const EXPECTED_COUNTY_COUNT = 22;

export interface RefreshAdminUnitsDeps {
  fetchImpl: (url: string) => Promise<Response>;
  writeFile: (path: string, body: string) => Promise<void>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  processExit: (code: number) => void;
  seedPath: string;
}

interface RawFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }>;
}

async function fetchCollection(
  url: string,
  deps: RefreshAdminUnitsDeps,
): Promise<RawFeatureCollection | undefined> {
  let response: Response;
  try {
    response = await deps.fetchImpl(url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    deps.stderr(`failed to fetch ${url}: ${reason}\n`);
    deps.processExit(1);
    return undefined;
  }
  if (!response.ok) {
    deps.stderr(`failed to fetch ${url}: HTTP ${response.status}\n`);
    deps.processExit(1);
    return undefined;
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as RawFeatureCollection;
  } catch {
    deps.stderr(
      `g0v response was not valid JSON; got first 200 chars: ${text.slice(0, 200)}\n`,
    );
    deps.processExit(1);
    return undefined;
  }
}

function readProp(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * g0v townships ship with `COUNTYNAME` (the parent county's human-readable
 * name) but not `COUNTYSN` / `COUNTYCODE`. `normalizeAdminUnits` expects a
 * parent code, so we resolve `COUNTYNAME → COUNTYSN` using the county pass
 * and inject `COUNTYSN` onto each township before normalisation. Townships
 * whose `COUNTYNAME` is not in the map are left as-is (the normaliser will
 * throw a clear "missing parent" error if any slip through).
 */
function injectCountySn(
  townships: RawFeatureCollection["features"],
  counties: RawFeatureCollection["features"],
): void {
  const nameToSn = new Map<string, string>();
  for (const county of counties) {
    const name = readProp(county.properties, "COUNTYNAME");
    const sn = readProp(county.properties, "COUNTYSN");
    if (name && sn) nameToSn.set(name, sn);
  }
  for (const township of townships) {
    if (
      readProp(township.properties, "COUNTYSN") ||
      readProp(township.properties, "COUNTYCODE")
    ) {
      continue; // already carries a parent code
    }
    const name = readProp(township.properties, "COUNTYNAME");
    if (!name) continue;
    const sn = nameToSn.get(name);
    if (sn) {
      township.properties.COUNTYSN = sn;
    }
  }
}

export async function refreshAdminUnits(
  deps: RefreshAdminUnitsDeps,
): Promise<void> {
  const counties = await fetchCollection(COUNTY_URL, deps);
  if (!counties) return;
  const towns = await fetchCollection(TOWN_URL, deps);
  if (!towns) return;

  if (counties.features.length !== EXPECTED_COUNTY_COUNT) {
    deps.stderr(
      `note: expected ${EXPECTED_COUNTY_COUNT} counties, got ${counties.features.length}\n`,
    );
  }

  injectCountySn(towns.features, counties.features);

  const merged: RawFeatureCollection = {
    type: "FeatureCollection",
    features: [...counties.features, ...towns.features],
  };
  // Cast through unknown because normalizeAdminUnits's input type is narrower
  // (Polygon | MultiPolygon) than the loose Raw shape we accept off the wire.
  const normalised = normalizeAdminUnits(
    merged as unknown as Parameters<typeof normalizeAdminUnits>[0],
  );
  await deps.writeFile(deps.seedPath, JSON.stringify(normalised, null, 2) + "\n");
  deps.stdout(
    `Wrote ${normalised.features.length} features to ${deps.seedPath}\n`,
  );
}
