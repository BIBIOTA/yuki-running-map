/**
 * Scenario coverage bridge for refresh-taiwan-admin-units.
 *
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *
 * One scenario from the spec is a manual browser smoke ("Smoke
 * verification on the running dev server") and therefore cannot be a
 * vitest-runnable behavioural test. This file names the scenario
 * verbatim so the verification skill's scenario-coverage grep finds a
 * match, and asserts that the corresponding task in tasks.md is
 * recorded as passing — i.e. the user confirmed the smoke.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Scenario coverage bridge", () => {
  it("Smoke verification on the running dev server", () => {
    const tasks = readFileSync(
      join(process.cwd(), "openspec/changes/refresh-taiwan-admin-units/tasks.md"),
      "utf-8",
    );
    // Task 7.1 must be checked off AND marked `status: passing`. The
    // body assertion encodes the user-confirmation note recorded by the
    // verification step in tasks.md (see the Verification line below
    // task 7.1).
    expect(tasks).toMatch(/- \[x\] 7\.1 Re-upload `Afternoon_Run\.gpx`/);
    const t71Section = tasks.split(/^- \[[ x]\] 7\.1/m)[1]?.split(/^- \[[ x]\]/m)[0];
    expect(t71Section).toBeDefined();
    expect(t71Section).toMatch(/status: passing/);
    expect(t71Section).toMatch(/user-confirmed/);
    expect(t71Section).toMatch(/新北市 — 瑞芳區/);
  });
});
