// Login and sign-up forms: errors show in plain words and the email stays filled in after one
// (React clears a form after its action runs, so the forms put the email back).
import { expect, test } from "@playwright/test";
import { newUser } from "./support";

test("a wrong password says so, keeps the email and clears the password; the right one logs in", async ({ page }) => {
  const user = await newUser();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(user.email);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/learning$/);
});

test("sign-up: passwords that don't match say so, and the email stays", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill("new-learner@example.test");
  await page.getByLabel(/^Password/).fill("Abcdefgh12");
  await page.getByLabel("Repeat password").fill("Abcdefgh13");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("new-learner@example.test");
});

test("sign-up with an email that already has an account: the friendly message, or a neutral success page", async ({ page }) => {
  const user = await newUser();
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel(/^Password/).fill("Abcdefgh12");
  await page.getByLabel("Repeat password").fill("Abcdefgh12");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  // The local Supabase answers "User already registered", shown as our friendly message. A project set to hide
  // which emails exist answers as if sign-up worked instead; that is fine too.
  await expect(page.getByText("An account with this email already exists. Try logging in.").or(page.getByRole("heading", { name: /check your email/i }))).toBeVisible();
});

test("sign-up refuses a password without upper- and lower-case letters (A–Z, a–z) and a number, or under 10 characters", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill("weak-password@example.test");
  const password = page.getByLabel(/^Password/);
  await expect(page.getByText("At least 10 characters, with upper- and lower-case letters (A–Z, a–z; umlauts and ß don't count) and a number.")).toBeVisible();
  for (const weak of ["abcdefgh12", "ABCDEFGH12", "Abcdefghij", "Abcdef12", "ÄBCDEFGHä1"]) {
    await password.fill(weak);
    expect(await password.evaluate((el: HTMLInputElement) => el.validity.valid), weak).toBe(false);
  }
  await password.fill("Abcdefgh12");
  expect(await password.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);
});

test("the server refuses a weak password even if the browser check is skipped, with the plain rule as the message", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await page.locator("form").evaluate((form: HTMLFormElement) => (form.noValidate = true));
  await page.getByLabel("Email").fill("weak-server@example.test");
  await page.getByLabel(/^Password/).fill("abcdefgh12");
  await page.getByLabel("Repeat password").fill("abcdefgh12");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^At least 10 characters, with upper- and lower-case letters/ })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-up$/);
});
