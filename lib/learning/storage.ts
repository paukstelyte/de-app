import type { SupabaseClient } from "@supabase/supabase-js";

type Bucket = ReturnType<SupabaseClient["storage"]["from"]>;

/** Every file path under `<userId>/` (layout: <userId>/<batchId>/<index>.<ext>).
 * Throws if a listing fails, so account deletion can stop instead of leaving files behind. */
export async function listUserUploads(storage: Bucket, userId: string): Promise<string[]> {
  const { data: batches, error } = await storage.list(userId);
  if (error) throw error;
  const lists = await Promise.all(
    batches.map(async (b) => {
      const { data, error } = await storage.list(`${userId}/${b.name}`);
      if (error) throw error;
      return data.map((f) => `${userId}/${b.name}/${f.name}`);
    }),
  );
  return lists.flat();
}
