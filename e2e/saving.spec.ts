// Answers that fail to save are shown under the exercise with a Retry, practice carries on,
// and a retried answer is counted exactly once (each answer has its own id).
import { expect, test, type Page } from "@playwright/test";
import { answer, attemptCount, logIn, newUser } from "./support";

/** Server actions are POSTs to the page with a Next-Action header. */
const isSave = (method: string, headers: Record<string, string>) => method === "POST" && !!headers["next-action"];

/** Makes the next `n` answer saves fail in the browser. With `reachServer`, each one is saved first
 * and only the reply is lost (the browser can't tell, so it retries an answer that was already saved). */
async function failSaves(page: Page, n: number, reachServer: boolean) {
  let left = n;
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (left > 0 && isSave(req.method(), req.headers())) {
      left--;
      if (reachServer) await route.fetch();
      return route.abort("failed");
    }
    return route.continue();
  });
}

test("an exercise answer that fails to save shows '1 answer not saved', practice continues, Retry saves it once", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user, "/topics/modal-verbs/practice");
  await failSaves(page, 1, true); // saved on the server, but the reply never arrives
  await answer(page, "modal-verbs", "right");
  await expect(page.getByText("1 answer not saved.")).toBeVisible();
  await expect(page.getByText("Question 2 of 10")).toBeVisible(); // practice was not blocked
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText(/not saved/)).toBeHidden();
  expect(await attemptCount(user.id, "modal-verbs")).toBe(1); // the retry didn't count it twice
});

test("an answer that never reached the server is saved by Retry", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user, "/topics/modal-verbs/practice");
  await failSaves(page, 2, false);
  await answer(page, "modal-verbs", "wrong");
  await page.keyboard.press("Enter");
  await answer(page, "modal-verbs", "right");
  await expect(page.getByText("2 answers not saved.")).toBeVisible();
  expect(await attemptCount(user.id)).toBe(0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText(/not saved/)).toBeHidden();
  expect(await attemptCount(user.id, "modal-verbs")).toBe(2);
});

test("der · die · das: a failed save shows the note and Retry saves it", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user, "/articles");
  await failSaves(page, 1, false);
  await page.getByRole("button", { name: "der", exact: true }).click();
  await expect(page.getByText("1 answer not saved.")).toBeVisible();
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText(/not saved/)).toBeHidden();
  expect(await attemptCount(user.id, "articles")).toBe(1);
});

test("logged out mid-round: the note says so and links to log in", async ({ page, context }) => {
  const user = await newUser();
  await logIn(page, user, "/topics/modal-verbs/practice");
  await context.clearCookies();
  await answer(page, "modal-verbs", "right");
  await expect(page.getByText(/1 answer not saved because you've been logged out/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).last()).toHaveAttribute("target", "_blank");
});
