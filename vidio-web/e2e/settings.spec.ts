import { test, expect } from "@playwright/test";
import { assertNoSeriousAxeViolations, login } from "./helpers";

test.describe("settings and preferences", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("installs an add-on and updates preferences", async ({ page }) => {
    await page.goto("/settings/addons");
    await assertNoSeriousAxeViolations(page, "settings addons");

    await page.getByLabel("HTTPS manifest URL").fill("https://example.com/manifest.json");
    await page.getByRole("button", { name: "Install add-on" }).click();
    await expect(page.getByText(/Installed Installed Add-on/i)).toBeVisible();

    await page.getByRole("link", { name: "Preferences" }).click();
    await expect(page.getByRole("navigation", { name: "Settings" })).toBeVisible();
    await page.getByLabel("Locale").fill("en-GB");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText(/Preferences saved/i)).toBeVisible();
    await assertNoSeriousAxeViolations(page, "settings preferences");

    await page.getByRole("link", { name: "Account" }).click();
    await expect(page.getByText("e2e@example.com")).toBeVisible();
    await assertNoSeriousAxeViolations(page, "settings account");
  });
});
