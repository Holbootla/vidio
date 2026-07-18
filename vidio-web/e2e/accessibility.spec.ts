import { test } from "@playwright/test";
import { assertNoSeriousAxeViolations, login } from "./helpers";

const primaryPages = [
  { path: "/login", setup: null },
  { path: "/register", setup: null },
  { path: "/board", setup: login },
  { path: "/search", setup: login },
  { path: "/library", setup: login },
  { path: "/settings/addons", setup: login },
  { path: "/settings/preferences", setup: login },
  { path: "/settings/account", setup: login },
];

for (const entry of primaryPages) {
  test(`axe: no serious/critical issues on ${entry.path}`, async ({ page }) => {
    if (entry.setup) {
      await entry.setup(page);
    }
    await page.goto(entry.path);
    await assertNoSeriousAxeViolations(page, entry.path);
  });
}
