import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("offline and shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("announces offline status in a live region", async ({ page, context }) => {
    await page.goto("/board");
    await expect(page.getByRole("heading", { name: "Popular Movies" })).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/Offline/i).first()).toBeVisible();
    await context.setOffline(false);
  });

  test("focuses search with / shortcut outside editable fields", async ({ page }) => {
    await page.goto("/board");
    await expect(page.getByRole("heading", { name: "Popular Movies" })).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.locator("#search-input")).toBeFocused();

    await page.locator("#search-input").fill("bunny");
    await page.locator("#search-input").press("Slash");
    await expect(page.locator("#search-input")).toHaveValue("bunny/");
  });
});
