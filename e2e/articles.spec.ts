// der · die · das: the level picker, keyboard play, waiting after mistakes, Restart, the
// rules page and phone width (guest only; logged-in saving is in saving.spec.ts).
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { feedback, moveOn, noHorizontalScroll } from "./support";

// The word list, so each card is answered on purpose (right or wrong), never by luck.
const DECK: { noun: string; article: string; exception: string }[] = JSON.parse(
  readFileSync(resolve("lib/flashcards/data/seed.json"), "utf8"),
);
const card = (noun: string) => DECK.find((c) => c.noun === noun)!;

const picker = (page: Page) => page.locator("fieldset");
const badge = (page: Page) => page.locator("[data-card-level]");
const noun = (page: Page) => page.locator("[data-card-level]").locator("xpath=..").locator("p").first();

const changed = (page: Page, before: string) => () => expect(noun(page)).not.toHaveText(before, { timeout: 1_000 });

/** Answers the card on screen wrong on purpose; it then waits for a click or Enter. */
async function answerWrong(page: Page) {
  const { article } = card((await noun(page).textContent())!);
  await page.getByRole("button", { name: article === "der" ? "die" : "der", exact: true }).click();
  await expect(feedback(page, "Not quite.")).toBeVisible();
}
/** Answers the card on screen right, and moves on: by itself, or with Enter on a card with an exception note. */
async function answerRightAndMoveOn(page: Page) {
  const before = (await noun(page).textContent())!;
  const { article, exception } = card(before);
  await page.getByRole("button", { name: article, exact: true }).click();
  await expect(feedback(page, "Correct!")).toBeVisible();
  if (exception) await moveOn(page, "Enter", changed(page, before));
  await expect(noun(page)).not.toHaveText(before);
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
    await answerRightAndMoveOn(page);
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
  const before = (await noun(page).textContent())!;
  await page.keyboard.press("Enter");
  await expect(feedback(page, card(before).article === "das" ? "Correct!" : "Not quite.")).toBeVisible();
  await expect(page.getByRole("button", { name: /continue/i })).toHaveCount(0);
  if (card(before).article !== "das" || card(before).exception) await moveOn(page, "Enter", changed(page, before));
  await expect(noun(page)).not.toHaveText(before);
});

test("a wrong answer waits for a click or Enter; Restart starts over", async ({ page }) => {
  await answerWrong(page);
  const before = await noun(page).textContent();
  await page.waitForTimeout(2500);
  await expect(noun(page)).toHaveText(before!);
  await expect(page.getByText("Tap or click anywhere, or press Enter to continue")).toBeVisible();
  await moveOn(page, "click", changed(page, before!));

  await answerWrong(page);
  const next = await noun(page).textContent();
  await moveOn(page, "Enter", changed(page, next!));

  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByText(/Card 1 of 30/i)).toBeVisible();
});

test("changing the level mid-round starts a fresh round from the new level", async ({ page }) => {
  const wrong = (await noun(page).textContent())!;
  await answerWrong(page);
  await moveOn(page, "Enter", changed(page, wrong));
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
