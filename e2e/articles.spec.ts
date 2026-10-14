// der · die · das: the level picker, keyboard play, waiting after mistakes, Restart, the
// rules page and phone width (guest only; logged-in saving is in saving.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./support";

const picker = (page: Page) => page.locator("fieldset");
const badge = (page: Page) => page.locator("[data-card-level]");
const noun = (page: Page) => page.locator("[data-card-level]").locator("xpath=..").locator("p").first();

/** Answers "der" on fresh cards until one is wrong (a right one moves on by itself). */
async function getAWrongAnswer(page: Page) {
  for (let i = 0; i < 10; i++) {
    const before = await noun(page).textContent();
    await page.getByRole("button", { name: "der", exact: true }).click();
    if (await page.getByText("Not quite.").isVisible()) return;
    await expect(noun(page)).not.toHaveText(before!);
  }
  throw new Error("ten 'der' cards in a row were right");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/articles");
  await expect(badge(page)).toBeVisible();
});

test("the level picker: A · B · C · All, All by default, C gives only C1/C2 cards", async ({ page }) => {
  await expect(picker(page).getByRole("button")).toHaveText(["A", "B", "C", "All"]);
  await expect(picker(page).locator("[aria-pressed=true]")).toHaveText("All");
  await expect(badge(page)).toHaveText(/^[ABC][12]$/);
  await picker(page).getByRole("button", { name: /^Level C/ }).click();
  await expect(picker(page).locator("[aria-pressed=true]")).toHaveText("C");
  for (let i = 0; i < 5; i++) {
    await expect(badge(page)).toHaveText(/^C[12]$/);
    const before = await noun(page).textContent();
    await page.keyboard.press("Enter"); // the first answer button is focused
    if (await page.getByText("Not quite.").isVisible()) await page.keyboard.press("Enter");
    await expect(noun(page)).not.toHaveText(before!);
  }
});

test("arrow keys choose, Enter picks, and the next card comes without a Continue button", async ({ page }) => {
  const der = page.getByRole("button", { name: "der", exact: true });
  await expect(der).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "die", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "das", exact: true })).toBeFocused();
  const before = await noun(page).textContent();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^(Correct!|Not quite\.)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /continue/i })).toHaveCount(0);
  if (await page.getByText("Not quite.").isVisible()) await page.keyboard.press("Enter");
  await expect(noun(page)).not.toHaveText(before!);
});

test("a wrong answer waits for a click or Enter; Restart starts over", async ({ page }) => {
  await getAWrongAnswer(page);
  const before = await noun(page).textContent();
  await page.waitForTimeout(2500);
  await expect(noun(page)).toHaveText(before!);
  await expect(page.getByText("Tap or click anywhere, or press Enter to continue")).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(noun(page)).not.toHaveText(before!);

  await getAWrongAnswer(page);
  const next = await noun(page).textContent();
  await page.keyboard.press("Enter");
  await expect(noun(page)).not.toHaveText(next!);

  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByText(/Card 1 of 30/i)).toBeVisible();
});

test("changing the level mid-round starts a fresh round from the new level", async ({ page }) => {
  await getAWrongAnswer(page);
  await page.keyboard.press("Enter");
  await picker(page).getByRole("button", { name: /^Level A/ }).click();
  await expect(page.getByText(/Card 1 of 30/i)).toBeVisible();
  await expect(badge(page)).toHaveText(/^A[12]$/);
  // A refresh keeps the level and starts a new round.
  await page.reload();
  await expect(picker(page).locator("[aria-pressed=true]")).toHaveText("A");
  await expect(page.getByText(/Card 1 of 30/i)).toBeVisible();
});

test("an old saved level choice (max level B1) becomes band B", async ({ page }) => {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("de-app:max-level", "B1"); });
  await page.reload();
  await expect(picker(page).locator("[aria-pressed=true]")).toHaveText("B");
});

test("the rules page lists the newer rules", async ({ page }) => {
  await page.goto("/rules");
  for (const rule of ["People ending in -ist", "Nouns of more than one syllable ending in -ast", "Nouns ending in -ich and -ig", "Nouns ending in -age", "Nouns ending in -ade", "Nouns ending in -ette"]) {
    await expect(page.getByText(rule).first()).toBeVisible();
  }
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(badge(page)).toBeVisible();
  await noHorizontalScroll(page);
});
