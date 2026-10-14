// The one test that calls the real model (npm run test:smoke; about $0.0005). It checks the live
// OpenRouter integration still works end to end: the app's request is accepted, the answer
// fits the schema, and the dative worksheet gets dative topics.
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { logIn, newUser, uploadInput } from "./support";

test("the real model reads the Lektion 7 PDF and suggests dative topics", async ({ page }) => {
  test.setTimeout(120_000);
  const user = await newUser();
  await logIn(page, user);
  await (await uploadInput(page)).setInputFiles(resolve("e2e/fixtures/lektion7.pdf"));
  await page.getByRole("button", { name: "Read this document" }).click();
  await expect(page.getByText("Done! Your topics are below.")).toBeVisible({ timeout: 90_000 });
  await page.reload();
  const doc = page.locator("section[aria-labelledby=docs-title] > ul > li").first();
  await expect(doc.locator('a[href="/topics/prepositions-dative"], a[href="/topics/dative-case"]').first()).toBeVisible();
});
