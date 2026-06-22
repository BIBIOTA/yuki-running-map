/**
 * Public /routes list — dynamic region filter spec.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "Public /routes list filter is dynamic from admin_units"
 *
 * Two scenarios:
 *   1. Empty state: with zero published routes the page shows the
 *      「目前沒有可篩選的縣市」 empty card and does NOT contain any of
 *      the hardcoded legacy strings (台北 / 新北 / 宜蘭 / 陽明山 / 其他).
 *   2. Populated state: with a published route seeded against a county,
 *      the filter list contains that county's name.
 *
 * Both run in the `e2e` workspace; integration of DATABASE_URL +
 * Supabase is handled by the existing test helpers.
 */

import { expect, test } from "@playwright/test";

import { truncateRoutes } from "./helpers/dbCleanup";
import { clearAdminUnits, seedAdminUnits, seedRoute } from "./helpers/seed";

const TAIPEI_POLY: number[][][][] = [
  [
    [
      [121.45, 24.96],
      [121.66, 24.96],
      [121.66, 25.21],
      [121.45, 25.21],
      [121.45, 24.96],
    ],
  ],
];

test.describe("public /routes — dynamic county filter", () => {
  test.beforeEach(async () => {
    await truncateRoutes();
    await clearAdminUnits();
  });

  test("Scenario: empty filter when no published routes exist", async ({ page }) => {
    await seedAdminUnits([
      { code: "63000", level: "county", name: "台北市", coordinates: TAIPEI_POLY },
    ]);

    await page.goto("/routes");

    // The empty card uses the spec-mandated text verbatim.
    await expect(
      page.getByText("目前沒有可篩選的縣市"),
    ).toBeVisible();

    // None of the legacy hardcoded filter labels should leak through.
    const filterAside = page.getByRole("complementary", { name: "filters" });
    for (const legacy of ["全部", "新北", "宜蘭", "陽明山", "其他"]) {
      await expect(filterAside.getByText(legacy, { exact: true })).toHaveCount(0);
    }
  });

  test("Scenario: filter renders the dynamic county list when published routes exist", async ({
    page,
  }) => {
    const ids = await seedAdminUnits([
      { code: "63000", level: "county", name: "台北市", coordinates: TAIPEI_POLY },
    ]);
    const taipeiId = ids[0];
    if (!taipeiId) throw new Error("expected taipei admin_unit id");
    const route = await seedRoute({
      slug: "dynamic-filter-route",
      title: "Dynamic filter route",
      published: true,
    });
    // Manually attach the join row so the filter EXISTS clause matches —
    // seedRoute does not detect regions on its own (that's createRoute's
    // job server-side).
    const postgres = (await import("postgres")).default;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL required");
    const sql = postgres(dbUrl, { prepare: false });
    try {
      await sql`INSERT INTO route_admin_units (route_id, admin_unit_id) VALUES (${route.id}, ${taipeiId})`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    await page.goto("/routes");

    const filterList = page.getByTestId("region-filters");
    await expect(filterList).toBeVisible();
    await expect(filterList.getByText("台北市")).toBeVisible();
  });
});
