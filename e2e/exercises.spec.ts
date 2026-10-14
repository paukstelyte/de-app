// Grammar practice pages (/topics/<slug>/practice): guest rounds, mistakes rounds, the keyboard,
// auto-advance and its setting, phone width, and answers saved for logged-in learners.
import { expect, test, type Page } from "@playwright/test";
import { answer, attemptCount, feedback, logIn, moveOn, newUser, nextQuestion, noHorizontalScroll, questionNumber } from "./support";

const HINT = "Tap or click anywhere, or press Enter to continue";
const continueButton = (page: Page) => page.getByRole("button", { name: /continue/i });

/** Answers questions on the current round until one of the wanted type is on screen (reshuffling if needed). */
async function reachType(page: Page, slug: string, type: "choice" | "type" | "order") {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(`/topics/${slug}/practice`);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByText(/Question \d+ of 10/)).toBeVisible();
      if (await isType(page, type)) return;
      const n = await questionNumber(page);
      await answer(page, slug, "right");
      await expect.poll(() => questionNumber(page)).not.toBe(n);
      if (n === 10) break; // round over: start a new one
    }
  }
  throw new Error(`no ${type} item reached on ${slug}`);
}
async function isType(page: Page, type: string) {
  if (type === "type") return (await page.locator("input[aria-label]").count()) > 0;
  if (type === "order") return (await page.getByRole("group", { name: "Words" }).count()) > 0;
  return (await page.getByRole("group", { name: "Choose the answer" }).count()) > 0;
}

test("guest pages, links and 404s", async ({ page }) => {
  await page.goto("/topics/dative-case/practice");
  await expect(page.getByText("Question 1 of 10")).toBeVisible();
  await page.goto("/topics/dative-case");
  await expect(page.locator('a[href="/topics/dative-case/practice"]')).toContainText("Start");
  await page.goto("/topics/noun-gender");
  await expect(page.locator('a[href*="/practice"]')).toHaveCount(0);
  await expect(page.locator('a[href*="/articles"]').first()).toBeVisible();
  for (const path of ["/topics/not-a-topic/practice", "/topics/noun-gender/practice"]) {
    await page.goto(path);
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  }
});

test("a guest round: 3 wrong and 7 right, the mistakes round, then Next 10; nothing is saved", async ({ page }) => {
  const slug = "separable-verbs";
  await page.goto(`/topics/${slug}/practice`);
  const types = new Set<string>();
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Question ${i} of 10`)).toBeVisible();
    const wrong = i <= 3;
    types.add(await answer(page, slug, wrong ? "wrong" : "right"));
    if (wrong) {
      await expect(feedback(page, "Not quite.")).toBeVisible();
      await expect(page.locator("p:not(.sr-only)", { hasText: /^Answer:/ })).toBeVisible();
      await moveOn(page, "click", nextQuestion(page, i)); // a wrong answer waits for a click
    }
  }
  await expect(page.getByText("Round complete!")).toBeVisible();
  await expect(page.getByText("You got 7 of 10")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in to save your progress" })).toBeVisible();
  await page.getByRole("button", { name: "Practise my mistakes (3)" }).click();
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByText(new RegExp(`Mistakes · Question ${i} of 3`, "i"))).toBeVisible();
    await answer(page, slug, "right");
  }
  await expect(page.getByText("Mistakes round complete!")).toBeVisible();
  await expect(page.getByText("You got 3 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /Practise my mistakes/ })).toBeHidden();
  await page.getByRole("button", { name: "Next 10 →" }).click();
  await expect(page.getByText("Question 1 of 10 · 0 correct")).toBeVisible();
  expect(types.size).toBeGreaterThan(1);
});

test("type item: Enter submits, a right answer moves on by itself, a wrong one waits for Enter", async ({ page }) => {
  await reachType(page, "simple-past", "type");
  const n = await questionNumber(page);
  await answer(page, "simple-past", "right");
  await expect(continueButton(page)).toHaveCount(0);
  await expect.poll(() => questionNumber(page)).toBe(n < 10 ? n + 1 : 0); // 0: the round is over

  await reachType(page, "simple-past", "type");
  const m = await questionNumber(page);
  await page.locator("input[aria-label]").fill("xxx");
  await page.keyboard.press("Enter");
  await expect(feedback(page, "Not quite.")).toBeVisible();
  await expect(page.getByText(HINT)).toBeVisible();
  await page.waitForTimeout(2500); // longer than the auto-advance delay
  expect(await questionNumber(page)).toBe(m);
  await page.keyboard.press("Enter");
  await expect.poll(() => questionNumber(page)).toBe(m < 10 ? m + 1 : 0);
});

test("choice item: arrow keys move between options and Enter picks; order item: arrows move between tiles", async ({ page }) => {
  await reachType(page, "simple-past", "choice");
  const options = page.locator("button[lang=de]");
  await expect(options.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(options.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(options.last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(feedback(page, "either")).toBeVisible();
  await expect(continueButton(page)).toHaveCount(0);

  await reachType(page, "separable-verbs", "order");
  const tiles = page.getByRole("group", { name: "Words" }).getByRole("button");
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toBeFocused();
  const n = await questionNumber(page);
  await answer(page, "separable-verbs", "wrong");
  await expect(page.getByText(HINT)).toBeVisible();
  await moveOn(page, "click", nextQuestion(page, n));
});

test("the auto-advance setting: 'when I click or press Enter' keeps a right answer on screen", async ({ page }) => {
  await reachType(page, "simple-past", "choice");
  await page.getByLabel("After a correct answer, go on").selectOption("off");
  const n = await questionNumber(page);
  await answer(page, "simple-past", "right");
  await expect(page.getByText(HINT)).toBeVisible();
  await page.waitForTimeout(2500);
  expect(await questionNumber(page)).toBe(n);
  await page.keyboard.press("Enter");
  await expect.poll(() => questionNumber(page)).toBe(n < 10 ? n + 1 : 0); // 0: the round is over
  // The choice is remembered in this browser.
  await page.reload();
  await expect(page.getByLabel("After a correct answer, go on")).toHaveValue("off");
});

test("phone width: no horizontal scroll on practice pages, answered or not", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ["dative-case", "separable-verbs"]) {
    await page.goto(`/topics/${slug}/practice`);
    await expect(page.getByText("Question 1 of 10")).toBeVisible();
    await noHorizontalScroll(page);
    await answer(page, slug, "wrong");
    await noHorizontalScroll(page);
  }
});

test("logged in: answers are saved and accuracy shows on the topic page and its card", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user, "/topics/modal-verbs/practice");
  await answer(page, "modal-verbs", "right");
  await expect(page.getByText("Question 2 of 10")).toBeVisible();
  await answer(page, "modal-verbs", "wrong");
  await expect(page.getByText("Question 2 of 10 · 1 correct")).toBeVisible();
  await expect.poll(() => attemptCount(user.id, "modal-verbs")).toBe(2);
  await page.goto("/topics/modal-verbs");
  await expect(page.getByText("Your accuracy so far")).toBeVisible();
  await page.goto("/topics");
  await expect(page.locator('a[href="/topics/modal-verbs"]')).toContainText("Your accuracy");
});
