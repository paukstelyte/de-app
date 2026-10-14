// Before every run: clear the local upload counter. Earlier runs' uploads would otherwise use up the
// app-wide limit of 100 a day, and the upload tests would see "Today's shared upload limit has been
// reached". Runs only against the local Supabase (playwright.config.ts refuses any other URL).
import { admin } from "./support";

export default async function globalSetup() {
  const { error } = await admin().from("learning_upload_usage").delete().gte("id", 0);
  if (error) throw new Error(`Couldn't clear the local upload counter: ${error.message}`);
}
