"use server";

import { revalidatePath } from "next/cache";
import { getTopic } from "@/lib/grammar/topics";
import { MAX_DOCUMENTS } from "@/lib/learning/allowance";
import { analyseDocument } from "@/lib/learning/analyse";
import { pdfPageCount, readDocxText } from "@/lib/learning/documents";
import { BUCKET, MAX_FILE_BYTES, MAX_PDF_PAGES, mimeFor, ownedPaths, validateSelection } from "@/lib/learning/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ERRORS = {
  loggedOut: "Please log in again.",
  files: "Something was wrong with the upload. Please try again.",
  limit: "You've reached the upload limit. \"Uploads left today\" shows when you can upload again.",
  docLimit: `You've reached the limit of ${MAX_DOCUMENTS} saved documents. Delete some to upload new ones.`,
  pdfPages: `This PDF has more than ${MAX_PDF_PAGES} pages. Please upload a shorter part.`,
  docx: "Couldn't read this Word file. Save it as PDF and upload that.",
  pdf: "Couldn't open this PDF. Save it again, or upload photos of the pages.",
  unreadablePhoto: "We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger.",
  unreadable: "We couldn't read any text in this PDF. If it's a scan, try a clearer copy or a photo. This upload still counts.",
  ai: "Couldn't read this document right now. Nothing was saved — please try again.",
  paid: "Couldn't read this document. Nothing was saved, and this upload still counts. Try a shorter part of it.",
  invalid: "The AI's answer for this document couldn't be used. Nothing was saved, and this upload still counts. Trying again usually works.",
  generic: "Something went wrong — please try again.",
};

/** Gives an upload back only when the AI read failed with no paid answer (see analyseDocument). A paid but unusable answer, a failed save and an unreadable document are NOT given back: the AI call was paid, and giving blank photos back would bypass the daily spend limit. Admin key, server only: users can't refund themselves. */
async function giveBackUpload(id: number, userId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.from("learning_upload_usage").delete().eq("id", id).eq("user_id", userId); // the admin key skips row-level security, so pin the row to its owner here
  if (error) console.error("giving back the upload failed:", error.message);
}

/** Reads the uploaded files with AI, saves the result, and always deletes the files. */
export async function analyseUpload(paths: unknown): Promise<{ id: number; noGrammar: boolean } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: ERRORS.loggedOut };
  const owned = ownedPaths(paths, userId);
  if (!owned) return { error: ERRORS.files };
  const storage = supabase.storage.from(BUCKET);

  try {
    // Same rules as the browser check; sizes are checked after download.
    const check = validateSelection(owned.map((name) => ({ name, size: 0 })));
    if ("error" in check) return { error: ERRORS.files };
    const { kind } = check;

    const files = [];
    for (const path of owned) {
      const { data: blob, error } = await storage.download(path);
      if (error || !blob || blob.size > MAX_FILE_BYTES) return { error: ERRORS.files };
      files.push({ name: path.split("/").pop()!, mime: mimeFor(path)!, data: Buffer.from(await blob.arrayBuffer()) });
    }
    if (kind === "pdf") {
      const pages = pdfPageCount(files[0].data);
      if (pages === null) return { error: ERRORS.pdf };
      if (pages > MAX_PDF_PAGES) return { error: ERRORS.pdfPages };
    }
    const docxText = kind === "docx" ? (await readDocxText(files[0].data)) ?? undefined : undefined;
    if (kind === "docx" && !docxText) return { error: ERRORS.docx };

    // Check the document limit before spending an AI call; the database trigger stays as the backstop.
    const { count } = await supabase.from("learning_documents").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= MAX_DOCUMENTS) return { error: ERRORS.docLimit };

    const { data: usageId, error: quotaError } = await supabase.rpc("use_upload_quota");
    if (quotaError || typeof usageId !== "number") return { error: quotaError?.code === "P0001" ? ERRORS.limit : ERRORS.generic };

    const result = await analyseDocument({ kind, files, docxText });
    if ("error" in result) {
      // A Word file always has text (checked above), so "no text" from the model is a bad answer there.
      if (result.error === "unreadable") return { error: kind === "images" ? ERRORS.unreadablePhoto : kind === "pdf" ? ERRORS.unreadable : ERRORS.invalid };
      if (result.error !== "ai") return { error: ERRORS[result.error] };
      await giveBackUpload(usageId, userId);
      return { error: ERRORS.ai };
    }
    const a = result.analysis;
    // Saved with the admin key: users can't insert documents themselves, so a document always
    // comes from a real, counted AI read. Pinned to the caller's own id.
    const admin = createAdminClient();
    if (!admin) return { error: ERRORS.generic };
    const { data: row, error } = await admin
      .from("learning_documents")
      .insert({
        user_id: userId, title: a.title, extracted_text: a.extractedText, no_grammar: a.noGrammar, suggestions: a.topics,
        model: result.usage.model, prompt_tokens: result.usage.promptTokens, completion_tokens: result.usage.completionTokens, cost_usd: result.usage.costUsd,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("saving learning document failed:", error?.message);
      return { error: error?.code === "P0001" ? ERRORS.docLimit : ERRORS.generic };
    }
    revalidatePath("/learning");
    return { id: row.id, noGrammar: a.noGrammar };
  } finally {
    // The original files are never kept, whatever happened above.
    const { error } = await storage.remove(owned);
    if (error) console.error("deleting uploaded files failed:", error.message);
  }
}

export async function deleteDocument(id: unknown): Promise<{ error?: string }> {
  if (!Number.isSafeInteger(id) || (id as number) <= 0) return { error: ERRORS.generic };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };
  const { error } = await supabase.from("learning_documents").delete().eq("id", id as number);
  if (error) {
    console.error("deleteDocument failed:", error.message);
    return { error: ERRORS.generic };
  }
  revalidatePath("/learning");
  return {};
}

/** Adds a topic to the focus by hand, or removes it. */
export async function setFocus(slug: unknown, kind: unknown): Promise<{ error?: string }> {
  if (typeof slug !== "string" || !getTopic(slug) || (kind !== "added" && kind !== "removed")) return { error: ERRORS.generic };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };
  const { error } = await supabase
    .from("learning_focus")
    .upsert({ topic_slug: slug, kind }, { onConflict: "user_id,topic_slug" }); // updated_at is set by the database
  if (error) {
    console.error("setFocus failed:", error.message);
    return { error: ERRORS.generic };
  }
  revalidatePath("/learning");
  revalidatePath(`/topics/${slug}`);
  return {};
}
