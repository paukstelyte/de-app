// Phone width with the on-screen keyboard open (emulated by a short viewport: Playwright can't
// open a real keyboard): the upload review step and the auto-advance setting stay usable.
import { expect, test } from "@playwright/test";
import { answer, logIn, newUser, noHorizontalScroll } from "./support";

const KEYBOARD_OPEN = { width: 390, height: 420 }; // an iPhone-sized screen minus the keyboard

test("upload review step at phone width with the keyboard open", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user);
  await page.setViewportSize(KEYBOARD_OPEN);
  const photos = [1, 2, 3].map(() => new URL("./fixtures/blank.png", import.meta.url).pathname);
  await page.locator("#learning-upload").setInputFiles(photos);
  const read = page.getByRole("button", { name: "Read these photos" });
  await read.scrollIntoViewIfNeeded();
  await expect(read).toBeInViewport();
  await expect(page.getByRole("button", { name: "Choose again" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("typing an answer at phone width with the keyboard open: the setting and feedback fit", async ({ page }) => {
  await page.setViewportSize(KEYBOARD_OPEN);
  for (let i = 0; i < 10; i++) {
    await page.goto("/topics/simple-past/practice");
    if (await page.locator("input[aria-label]").count()) break;
  }
  test.skip(!(await page.locator("input[aria-label]").count()), "no type item came up first in 10 tries");
  await page.locator("input[aria-label]").focus();
  await noHorizontalScroll(page);
  await answer(page, "simple-past", "wrong");
  await noHorizontalScroll(page);
  const setting = page.getByLabel("After a correct answer, go on");
  await setting.scrollIntoViewIfNeeded();
  await expect(setting).toBeInViewport();
});
