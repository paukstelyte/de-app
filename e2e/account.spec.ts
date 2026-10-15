// The Account page: "Download my data" (only your own data, never a guest's way in) and deleting
// an account (the user, their rows and any leftover uploaded file all go).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, logIn, newUser, type User } from "./support";

async function saveAnswer(user: User, answer: string) {
  const { error } = await admin().from("attempts").insert({ user_id: user.id, topic: "dative-case", item_id: "dc-01", answer, correct: true });
  if (error) throw error;
}

test("Download my data gives a JSON file with this user's data and nobody else's", async ({ page }) => {
  const [me, other] = [await newUser(), await newUser()];
  await saveAnswer(me, "mine-answer");
  await saveAnswer(other, "other-answer");
  await logIn(page, me, "/account");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my data" }).click()]);
  expect(download.suggestedFilename()).toBe("de-app-my-data.json");
  const data = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(data.account.email).toBe(me.email);
  expect(data.answers.map((a: { answer: string }) => a.answer)).toEqual(["mine-answer"]);
  expect(JSON.stringify(data)).not.toContain(other.email);
  expect(data.customizedLearning).toEqual({ documents: [], focus: [], uploads: [] });
});

test("a guest can't download anyone's data", async ({ request }) => {
  const res = await request.get("/account/export", { maxRedirects: 0 });
  expect([307, 401]).toContain(res.status()); // the login gate redirects; the route itself refuses
  expect(await res.text()).not.toContain("\"answers\"");
});

test("deleting the account removes the user, their answers and a leftover uploaded file", async ({ page }) => {
  const user = await newUser();
  await saveAnswer(user, "die");
  const leftover = `${user.id}/e2e-batch/0.png`;
  const { error } = await admin().storage.from("learning-uploads").upload(leftover, Buffer.from("not really a png"), { contentType: "image/png" });
  if (error) throw error;

  await logIn(page, user, "/account");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/\?account=deleted$/);

  const { data: gone } = await admin().auth.admin.getUserById(user.id);
  expect(gone.user).toBeNull();
  const { count } = await admin().from("attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  expect(count).toBe(0);
  const { data: files } = await admin().storage.from("learning-uploads").list(`${user.id}/e2e-batch`);
  expect(files ?? []).toHaveLength(0);
});
