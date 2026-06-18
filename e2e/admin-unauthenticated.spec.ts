import { expect, test } from "@playwright/test";

test("unauthenticated GET /admin/upload redirects to /admin/login", async ({ page }) => {
  const response = await page.goto("/admin/upload", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  await expect(page.getByText("Admin 登入")).toBeVisible();
});
