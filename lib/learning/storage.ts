import type { SupabaseClient } from "@supabase/supabase-js";

type Bucket = ReturnType<SupabaseClient["storage"]["from"]>;

/** Every file path under `<userId>/` (layout: <userId>/<batchId>/<index>.<ext>).
 * Errors are swallowed: cleanup is best-effort. */
export async function listUserUploads(storage: Bucket, userId: string): Promise<string[]> {
  const { data: batches } = await storage.list(userId);
  const lists = await Promise.all(
    (batches ?? []).map(async (b) => {
      const { data } = await storage.list(`${userId}/${b.name}`);
      return (data ?? []).map((f) => `${userId}/${b.name}/${f.name}`);
    }),
  );
  return lists.flat();
}
