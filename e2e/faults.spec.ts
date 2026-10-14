// A failed database read must look like a failure with a retry, never like an empty account.
// Runs after every other test (its own project in playwright.config.ts), because it takes a
// table offline on the local database for a moment.
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { logIn, newUser } from "./support";

const sql = (query: string) => execFileSync("npx", ["supabase", "db", "query", "--local", query], { stdio: "ignore" });

test("documents and focus that can't be read show \"Couldn't load\" with Try again, then recover", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user);
  sql("alter table public.learning_focus rename to learning_focus_offline");
  try {
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Couldn't load your focus list and documents");
    await expect(page.getByText("Upload a textbook page, worksheet, notes or homework.")).toBeHidden(); // not the empty state
    await page.goto("/learning/practice");
    await expect(page.getByRole("alert")).toContainText("Couldn't load your focus topics");
    await expect(page.getByText("Nothing to practise yet.")).toBeHidden();
  } finally {
    sql("alter table public.learning_focus_offline rename to learning_focus");
  }
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Nothing to practise yet.")).toBeVisible();
});
