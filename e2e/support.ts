// Shared helpers for the browser tests: throwaway users on the local Supabase, logging in,
// and answering exercises from the exercise data (right or deliberately wrong).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import type { Database } from "../lib/supabase/database.types";
import type { ExerciseItem } from "../lib/exercises/types";

/** Admin client for the LOCAL Supabase only (playwright.config.ts refuses any other URL). */
export const admin = () =>
  createClient<Database>(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export type User = { id: string; email: string; password: string };

/** A fresh, confirmed user that exists only in the local database, so tests never share data. */
export async function newUser(): Promise<User> {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password };
}

export async function logIn(page: Page, user: User, next = "/learning") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

/** How many answers a user has saved (optionally for one topic). */
export async function attemptCount(userId: string, topic?: string) {
  let q = admin().from("attempts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (topic) q = q.eq("topic", topic);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const items = (slug: string): ExerciseItem[] =>
  JSON.parse(readFileSync(new URL(`../lib/exercises/data/${slug}.json`, import.meta.url), "utf8")).items;
const flat = (s: string) => s.replace(/\s+/g, "");

/** Which item is on screen: a type item by its input label, an order item by its words, a choice item by its sentence. */
export async function currentItem(page: Page, slug: string): Promise<ExerciseItem> {
  const input = page.locator("input[aria-label]");
  if (await input.count()) {
    const label = await input.getAttribute("aria-label");
    const item = items(slug).find((i) => i.type === "type" && i.prompt.replace("___", "blank") + (i.hint ? ` ${i.hint}` : "") === label);
    if (item) return item;
  }
  const words = page.getByRole("group", { name: "Words" });
  if (await words.count()) {
    const shown = (await words.getByRole("button").allTextContents()).map((w) => w.trim()).sort();
    const item = items(slug).find((i) => i.type === "order" && [...i.words].sort().join("|") === shown.join("|"));
    if (item) return item;
  }
  const sentence = flat((await page.locator("p[lang=de]").first().textContent()) ?? "");
  const item = items(slug).find((i) => i.type === "choice" && flat(i.prompt.replace("___", "")) === sentence);
  if (item) return item;
  throw new Error(`no ${slug} item matches the page`);
}

/** Answers the question on screen, right or wrong, the way a learner would. Returns its type. */
export async function answer(page: Page, slug: string, mode: "right" | "wrong"): Promise<ExerciseItem["type"]> {
  const item = await currentItem(page, slug);
  if (item.type === "choice") {
    const options = (await page.locator("button[lang=de]").allTextContents()).map((o) => o.trim());
    const pick = options.find((o) => (o === item.answer) === (mode === "right"))!;
    await page.getByRole("button", { name: pick, exact: true }).click();
  } else if (item.type === "type") {
    await page.locator("input[aria-label]").fill(mode === "right" ? item.answers[0] : "xxx");
    await page.getByRole("button", { name: "Check" }).click();
  } else {
    let order = mode === "right" ? item.words : [...item.words].reverse();
    if (mode === "wrong" && order.join(" ") === item.words.join(" ")) order = [...order.slice(1), order[0]];
    const pool = page.getByRole("group", { name: "Words" });
    for (const w of order) await pool.getByRole("button", { name: w, exact: true }).and(page.locator(":enabled")).first().click();
    await page.getByRole("button", { name: "Check" }).click();
  }
  await expect(page.getByText(/^(Correct!|Not quite\.)$/)).toBeVisible();
  return item.type;
}

/** The "Question 3 of 10" number on screen. */
export async function questionNumber(page: Page) {
  const line = await page.getByText(/Question \d+ of \d+/).first().textContent();
  return Number(line!.match(/Question (\d+)/)![1]);
}
