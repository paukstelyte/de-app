/** What the user must type to confirm deleting their account. */
export const CONFIRM_WORD = "DELETE";

/** Where users write about their data (privacy page, failed account deletion). */
export const CONTACT = "egle.pauk.ai@gmail.com";

/** Rows per request when exporting: the API returns at most 1000 rows at a time (`max_rows`). */
export const PAGE_SIZE = 1000;

/** Reads every row by asking for one page at a time (rows from..to, inclusive) until a short page. */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error(error?.message ?? "no data");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
