"use server";

import { revalidatePath } from "next/cache";
import { getTopic } from "@/lib/grammar/topics";
import { analyseDocument } from "@/lib/learning/analyse";
import { extractDocxText } from "@/lib/learning/docx";
import { BUCKET, MAX_FILE_BYTES, MAX_PDF_PAGES, mimeFor, ownedPaths, type UploadKind } from "@/lib/learning/uploads";
import { createClient } from "@/lib/supabase/server";

const ERRORS = {
  loggedOut: "Please log in again.",
  files: "Something was wrong with the upload. Please try again.",
  limit: "You've reached today's upload limit (10 a day). Please try again tomorrow.",
  docLimit: "You've reached the limit of 200 saved documents. Delete some to upload new ones.",
  pdfPages: "This PDF has more than 20 pages. Please upload a shorter part.",
  docx: "Couldn't read this Word file. Save it as PDF and upload that.",
  ai: "Couldn't read this document right now. Nothing was saved — please try again.",
  generic: "Something went wrong — please try again.",
};

/** Reads the uploaded files with AI, saves the result, and always deletes the files. */
export async function analyseUpload(paths: unknown): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: ERRORS.loggedOut };
  const owned = ownedPaths(paths, userId);
  if (!owned) return { error: ERRORS.files };
  const storage = supabase.storage.from(BUCKET);

  try {
    const { error: quotaError } = await supabase.rpc("use_upload_quota");
    if (quotaError) return { error: quotaError.code === "P0001" ? ERRORS.limit : ERRORS.generic };

    const files = [];
    for (const path of owned) {
      const { data: blob, error } = await storage.download(path);
      const mime = mimeFor({ name: path, size: 0, type: "" });
      if (error || !blob || !mime || blob.size > MAX_FILE_BYTES) return { error: ERRORS.files };
      files.push({ name: path.split("/").pop()!, mime, data: Buffer.from(await blob.arrayBuffer()) });
    }
    const kind: UploadKind = files[0].mime === "application/pdf" ? "pdf" : files[0].mime.includes("wordprocessingml") ? "docx" : "images";
    if (kind !== "images" && files.length > 1) return { error: ERRORS.files };
    if (kind === "images" && !files.every((f) => f.mime.startsWith("image/"))) return { error: ERRORS.files };
    if (kind === "pdf" && (files[0].data.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0) > MAX_PDF_PAGES) {
      return { error: ERRORS.pdfPages };
    }
    const docxText = kind === "docx" ? extractDocxText(files[0].data) ?? undefined : undefined;
    if (kind === "docx" && !docxText) return { error: ERRORS.docx };

    const result = await analyseDocument({ kind, files, docxText });
    if ("error" in result) return { error: result.error === "unreadable" ? ERRORS.docx : ERRORS.ai };
    const a = result.analysis;
    const { data: row, error } = await supabase
      .from("learning_documents")
      .insert({ title: a.title, extracted_text: a.extractedText, no_grammar: a.noGrammar, suggestions: a.topics })
      .select("id")
      .single();
    if (error || !row) {
      console.error("saving learning document failed:", error?.message);
      return { error: error?.code === "P0001" ? ERRORS.docLimit : ERRORS.generic };
    }
    revalidatePath("/learning");
    return { id: row.id };
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
  if (error) return { error: ERRORS.generic };
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
    .upsert({ topic_slug: slug, kind, updated_at: new Date().toISOString() }, { onConflict: "user_id,topic_slug" });
  if (error) {
    console.error("setFocus failed:", error.message);
    return { error: ERRORS.generic };
  }
  revalidatePath("/learning");
  revalidatePath(`/topics/${slug}`);
  return {};
}
