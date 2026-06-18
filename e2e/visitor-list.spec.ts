import { expect, test } from "@playwright/test";

test("routes list page shows empty-state placeholder", async ({ page }) => {
  await page.goto("/routes");

  await expect(page.getByRole("heading", { name: "路線列表" })).toBeVisible();
  await expect(page.getByText("目前無路線")).toBeVisible();
});
