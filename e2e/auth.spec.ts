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
  await page.getByLabel(/^Password/).fill("abcdefg1");
  await page.getByLabel("Repeat password").fill("abcdefg2");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("new-learner@example.test");
});

test("sign-up with an email that already has an account: the friendly message, or a neutral success page", async ({ page }) => {
  const user = await newUser();
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel(/^Password/).fill("abcdefg1");
  await page.getByLabel("Repeat password").fill("abcdefg1");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  // The local Supabase answers "User already registered", shown as our friendly message. A project set to hide
  // which emails exist answers as if sign-up worked instead; that is fine too.
  await expect(page.getByText("An account with this email already exists. Try logging in.").or(page.getByRole("heading", { name: /check your email/i }))).toBeVisible();
});
