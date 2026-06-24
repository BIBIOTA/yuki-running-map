/**
 * CLI entry: `pnpm refresh:admin-units` (also runnable via
 * `pnpm tsx scripts/refresh-admin-units.ts`).
 *
 * Thin wrapper around `refreshAdminUnits` — supplies the real fetch /
 * writeFile / stdout / stderr / processExit dependencies; the pipeline
 * logic itself lives in `lib/admin-units-refresh/refreshAdminUnits.ts`
 * so the same code path is unit-testable in vitest.
 *
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *       Requirement "refresh-admin-units convenience wrapper script"
 * Runbook: docs/runbooks/admin-units-refresh.md
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DEFAULT_SEED_PATH,
  refreshAdminUnits,
} from "../lib/admin-units-refresh/refreshAdminUnits";

async function main(): Promise<void> {
  await refreshAdminUnits({
    fetchImpl: (url) => fetch(url),
    writeFile: (path, body) => writeFile(path, body, "utf-8"),
    stdout: (line) => process.stdout.write(line),
    stderr: (line) => process.stderr.write(line),
    processExit: (code) => process.exit(code),
    seedPath: resolve(DEFAULT_SEED_PATH),
  });
}

main();
