import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// Browser tests run against a throwaway local Supabase (npm run db:start, needs OrbStack or
// Docker), never the live project, and against a fake OpenRouter (e2e/mock-openrouter.mjs).
// `npm run test:smoke` (E2E_REAL_AI=1) runs only the smoke test, with the real model.
const realAI = !!process.env.E2E_REAL_AI;
const PORT = 3100;
const MOCK_PORT = 3199;

function localSupabase() {
  if (!process.env.E2E_SUPABASE_URL) {
    let status;
    try {
      status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    } catch {
      throw new Error("The local Supabase isn't running. Start it with `npm run db:start` (needs OrbStack or Docker).");
    }
    process.env.E2E_SUPABASE_URL = status.API_URL;
    process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
    process.env.E2E_SUPABASE_SECRET_KEY = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  }
  // Checked every time, however the URL was set: tests use the secret key, so they must never reach the live project.
  const url = process.env.E2E_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`Refusing to test against ${url}: tests only run on the local Supabase.`);
}
localSupabase();

const appEnv: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY!,
  SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SECRET_KEY!,
  E2E: "1",
  NEXT_DIST_DIR: ".next-e2e", // its own build, so `npm run build` / `npm run dev` output is left alone
  ...(realAI
    ? {} // OPENROUTER_API_KEY comes from .env.local, which Next loads
    : { OPENROUTER_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, OPENROUTER_API_KEY: "mock-key" }),
};

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Every test makes its own users, so tests don't share data; a few workers keep the local stack calm.
  workers: 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: realAI
    ? [{ name: "real-model", testMatch: "smoke.real.spec.ts" }]
    : [
        { name: "app", testIgnore: ["smoke.real.spec.ts", "faults.spec.ts"] },
        // Takes a table offline for a moment, so it runs alone, after everything else.
        { name: "faults", testMatch: "faults.spec.ts", dependencies: ["app"] },
      ],
  webServer: [
    ...(realAI ? [] : [{ command: "node e2e/mock-openrouter.mjs", url: `http://127.0.0.1:${MOCK_PORT}/health`, env: { MOCK_OPENROUTER_PORT: String(MOCK_PORT) }, reuseExistingServer: false }]),
    {
      command: `npx next build && npx next start --port ${PORT}`,
      url: `http://127.0.0.1:${PORT}`,
      env: appEnv,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
