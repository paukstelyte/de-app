// Customized Learning: login redirects, the review step before an upload, every upload kind
// and outcome (with the fake OpenRouter), the upload counter, files deleted, focus buttons,
// deleting documents, and a second user seeing none of it.
import { resolve } from "node:path";
import { copyFileSync, appendFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { admin, logIn, newUser, type User, uploadInput } from "./support";

const FX = resolve("e2e/fixtures") + "/";
const docs = (page: Page) => page.locator("section[aria-labelledby=docs-title] > ul > li");
const focus = (page: Page) => page.locator("section[aria-labelledby=focus-title]");

async function uploadsUsed(user: User) {
  const { count } = await admin().from("learning_upload_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return count ?? 0;
}
async function filesInBucket(user: User) {
  const { data } = await admin().storage.from("learning-uploads").list(user.id);
  return data?.length ?? 0;
}
/** Picks files in the upload box, checks the review step lists them, then reads them. */
async function upload(page: Page, files: string[]) {
  await page.goto("/learning");
  await (await uploadInput(page)).setInputFiles(files);
  const chosen = page.getByLabel("Chosen files");
  for (const f of files) await expect(chosen).toContainText(f.split("/").pop()!);
  await chosen.getByRole("button", { name: /^Read / }).click();
}
/** A copy of the blank photo carrying a marker that tells the fake OpenRouter how to answer. */
function markedPhoto(path: string, marker: string) {
  copyFileSync(`${FX}blank.png`, path);
  appendFileSync(path, marker);
  return path;
}

test("signed-out visitors are sent to login, and logging in lands on Customized Learning", async ({ page }) => {
  await page.goto("/learning");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/learning/practice");
  await expect(page).toHaveURL(/\/login\?next=%2Flearning%2Fpractice$/);
  const user = await newUser();
  await logIn(page, user);
  await page.goto("/");
  await expect(page).toHaveURL(/\/learning$/);
});

test("choosing files only shows them; nothing is uploaded or counted until Read", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user);
  await (await uploadInput(page)).setInputFiles(`${FX}lektion7.pdf`);
  await expect(page.getByLabel("Chosen files")).toContainText("lektion7.pdf");
  await expect(page.getByText("Reading uses 1 of your uploads.")).toBeVisible();
  await page.getByRole("button", { name: "Choose again" }).click();
  await expect(page.getByLabel("Chosen files")).toBeHidden();
  expect(await uploadsUsed(user)).toBe(0);
  expect(await filesInBucket(user)).toBe(0);
});

test("photo previews show, and new ones replace them after Choose again, with no errors", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const user = await newUser();
  await logIn(page, user);
  const previews = page.getByLabel("Chosen files").locator("img");
  const loaded = () => previews.evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0));
  await (await uploadInput(page)).setInputFiles([markedPhoto(info.outputPath("a.png"), ""), markedPhoto(info.outputPath("b.png"), "")]);
  await expect(previews).toHaveCount(2);
  await expect.poll(loaded).toBe(true);
  await page.getByRole("button", { name: "Choose again" }).click();
  await expect(previews).toHaveCount(0);
  await (await uploadInput(page)).setInputFiles(markedPhoto(info.outputPath("c.png"), ""));
  await expect(previews).toHaveCount(1);
  await expect.poll(loaded).toBe(true);
  await page.goto("/topics"); // leave with files chosen: the box closes and releases its previews
  await page.goBack();
  expect(errors).toEqual([]);
});

test("a Word file shows the note about corrections before reading", async ({ page }) => {
  const user = await newUser();
  await logIn(page, user);
  await (await uploadInput(page)).setInputFiles(`${FX}lektion7.docx`);
  await expect(page.getByText(/Word files are read as plain text/)).toBeVisible();
});

for (const file of ["lektion7.pdf", "lektion7.heic", "lektion7.docx"]) {
  test(`${file}: the document is saved with its topics, they reach "Your focus now", and the file is deleted`, async ({ page }) => {
    const user = await newUser();
    await logIn(page, user);
    await upload(page, [`${FX}${file}`]);
    await expect(page.getByText("Done! Your topics are below.")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(docs(page).first()).toContainText("Lektion 7");
    await expect(docs(page).first().locator('a[href="/topics/prepositions-dative"]')).toBeVisible();
    await expect(focus(page).locator('a[href="/topics/prepositions-dative"]')).toBeVisible();
    await expect(docs(page).first()).toContainText("AI-suggested by Gemini 2.5 Flash Lite");
    expect(await uploadsUsed(user)).toBe(1);
    expect(await filesInBucket(user)).toBe(0);
  });
}

test("a photo with no readable text is refused, not saved, and still counts", async ({ page }, info) => {
  const user = await newUser();
  await logIn(page, user);
  await upload(page, [markedPhoto(info.outputPath("blank.png"), "MOCK:BLANK")]);
  await expect(page.getByText("We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger.")).toBeVisible();
  await expect(docs(page)).toHaveCount(0);
  expect(await uploadsUsed(user)).toBe(1);
  expect(await filesInBucket(user)).toBe(0);
});

test("an AI answer with no catalogue topics is an error, not \"no grammar\"", async ({ page }, info) => {
  const user = await newUser();
  await logIn(page, user);
  await upload(page, [markedPhoto(info.outputPath("invalid.png"), "MOCK:INVALID")]);
  await expect(page.getByText(/The AI's answer for this document couldn't be used/)).toBeVisible();
  await expect(docs(page)).toHaveCount(0);
  expect(await uploadsUsed(user)).toBe(1);
});

test("a document with text but no grammar is saved as such", async ({ page }, info) => {
  const user = await newUser();
  await logIn(page, user);
  await upload(page, [markedPhoto(info.outputPath("list.png"), "MOCK:NOGRAMMAR")]);
  await expect(page.getByText(/couldn't find German grammar topics/)).toBeVisible();
  await page.reload();
  await expect(docs(page).first()).toContainText("No German grammar topics found in this document.");
});

test("a .doc file and 6 photos are refused in the browser, using no upload and no storage", async ({ page }, info) => {
  const user = await newUser();
  await logIn(page, user);
  await (await uploadInput(page)).setInputFiles(`${FX}old.doc`);
  await expect(page.getByText("Please upload a PDF, Word (.docx), JPG, PNG, WebP or HEIC file.")).toBeVisible();
  const six = [1, 2, 3, 4, 5, 6].map((i) => markedPhoto(info.outputPath(`p${i}.png`), ""));
  await (await uploadInput(page)).setInputFiles(six);
  await expect(page.getByText("Upload at most 5 photos at a time.")).toBeVisible();
  expect(await uploadsUsed(user)).toBe(0);
  expect(await filesInBucket(user)).toBe(0);
});

test("focus buttons, deleting a document, and a second user sees none of it", async ({ page, browser }) => {
  const user = await newUser();
  await logIn(page, user);
  await upload(page, [`${FX}lektion7.pdf`]);
  await expect(page.getByText("Done! Your topics are below.")).toBeVisible({ timeout: 30_000 });
  await page.reload();

  const item = focus(page).locator("li", { has: page.locator('a[href="/topics/dative-case"]') });
  await item.getByRole("button", { name: "Remove from my focus" }).click();
  await expect(focus(page).locator('a[href="/topics/dative-case"]')).toBeHidden();

  await page.goto("/topics/modal-verbs");
  await page.getByRole("button", { name: "Add to my focus" }).click();
  await expect(page.getByText("In your focus ·")).toBeVisible(); // saved before leaving the page
  await page.goto("/learning");
  await expect(focus(page).locator('a[href="/topics/modal-verbs"]')).toBeVisible();

  const other = await newUser();
  const otherPage = await (await browser.newContext()).newPage();
  await logIn(otherPage, other);
  await expect(otherPage.getByText("Lektion 7")).toBeHidden();
  await expect(docs(otherPage)).toHaveCount(0);
  for (const slug of ["prepositions-dative", "dative-case", "modal-verbs"]) {
    await expect(focus(otherPage).locator(`a[href="/topics/${slug}"]`)).toHaveCount(0);
  }

  await docs(page).first().getByRole("button", { name: "Delete" }).click();
  await docs(page).first().getByRole("button", { name: "Yes, delete it" }).click();
  await expect(docs(page)).toHaveCount(0);
  await page.reload();
  await expect(docs(page)).toHaveCount(0);
});
