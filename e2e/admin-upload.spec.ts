/**
 * Admin GPX upload happy-path e2e.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.1
 *
 * Coverage:
 *   admin OAuth-mock fixture → /admin/upload → drop sample.gpx
 *   → assert map preview container + metadata form mount →
 *   fill title / slug / difficulty / published →
 *   click 「儲存」 → assert navigation to /admin/routes,
 *   sonner toast 「已新增「E2E Route」」 visible, and the new
 *   row appears in the table.
 *
 * Each test truncates the `routes` table and clears the `gpx` Storage
 * bucket before running so the cell-visibility assertion is precise
 * (no stale rows from prior runs match the title).
 *
 * Execution gating: the entire file is skipped when any of the four
 * env knobs below is missing, which keeps `pnpm test:e2e` green on
 * developer machines that have not yet wired up a real Supabase
 * project. The spec is fully authored + committed so a future
 * environment with the secrets populated can run it without changes —
 * verification of actual pass status is therefore VERIFICATION-PENDING
 * (see openspec/changes/feat-admin-gpx-upload/tasks.md).
 */

import { expect, test } from "@playwright/test";

import {
  ADMIN_USERNAME,
  DATABASE_URL,
  SERVICE_ROLE_KEY,
  signInAsAdmin,
  SUPABASE_URL,
} from "./helpers/adminAuth";
import { clearGpxBucket, truncateRoutes } from "./helpers/dbCleanup";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_USERNAME || !DATABASE_URL,
  "Skipping admin upload e2e: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_GITHUB_USERNAME / DATABASE_URL not set",
);

test.describe("admin upload flow", () => {
  test.beforeEach(async () => {
    await truncateRoutes();
    await clearGpxBucket();
  });

  test("admin uploads GPX, sees preview, fills metadata, saves, lands on /admin/routes with toast", async ({
    page,
    context,
    baseURL,
  }) => {
    // 1. Sign in as admin via shared OAuth-mock fixture.
    await signInAsAdmin(page, context, baseURL);

    // 2. Navigate to /admin/upload — empty-state dropzone visible.
    const response = await page.goto("/admin/upload", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("拖放 GPX 或點擊選擇")).toBeVisible();

    // 3. Drop sample.gpx via the hidden <input type="file"> that
    //    <GpxDropzone> renders for keyboard / programmatic access.
    const fixturePath = "e2e/fixtures/sample.gpx";
    const fileInput = page.locator('input[type="file"][accept=".gpx"]');
    await fileInput.setInputFiles(fixturePath);

    // 4. Map preview container + metadata form mount once parseGpx
    //    succeeds. Both expose aria-labels we can target without
    //    coupling to Tailwind class names.
    await expect(page.getByRole("img", { name: "路線預覽地圖" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("form", { name: "路線資料表單" })).toBeVisible();

    // 5. Fill metadata. Labels are 繁體中文 and load-bearing — they
    //    must stay in sync with RouteMetadataForm.tsx.
    await page.getByLabel("標題").fill("E2E Route");
    await page.getByLabel("網址代稱（slug）").fill("e2e-route");
    await page.getByLabel("難度").selectOption("easy");
    await page.getByLabel("已發佈").check();

    // 6. Submit. The button text flips to 「儲存中…」 during the
    //    Server Action; we wait on the post-success navigation.
    await page.getByRole("button", { name: "儲存" }).click();

    // 7. After createRoute succeeds: router.push('/admin/routes') +
    //    sonner toast 「已新增「E2E Route」」 + new table row.
    await expect(page).toHaveURL(/\/admin\/routes$/);
    await expect(page.getByText("已新增「E2E Route」")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("cell", { name: "E2E Route" })).toBeVisible();
  });
});
