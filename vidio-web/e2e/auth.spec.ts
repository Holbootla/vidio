import { test, expect } from "@playwright/test";
import { assertNoSeriousAxeViolations, login, register } from "./helpers";

test.describe("auth flows", () => {
  test("registers and lands on board", async ({ page }) => {
    await register(page);
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
    await assertNoSeriousAxeViolations(page, "board after register");
  });

  test("logs in with existing credentials", async ({ page }) => {
    await login(page);
    await assertNoSeriousAxeViolations(page, "board after login");
  });
});
