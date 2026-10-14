// Every practice page opens as a guest, shows its first question and logs no errors.
import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const slugs = readdirSync(resolve("lib/exercises/data")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

for (const slug of slugs) {
  test(`/topics/${slug}/practice shows question 1 with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/topics/${slug}/practice`);
    await expect(page.getByText("Question 1 of 10")).toBeVisible();
    await expect(page.locator("main").locator("button, input").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
