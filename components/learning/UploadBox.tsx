"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyseUpload } from "@/app/learning/actions";
import { createClient } from "@/lib/supabase/client";
import { listUserUploads } from "@/lib/learning/storage";
import { BUCKET, UPLOAD_NOTE, mimeFor, storagePath, validateSelection } from "@/lib/learning/uploads";

const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function UploadBox({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error" | "done"; text: string }>({ kind: "idle", text: "" });

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    const check = validateSelection(files.map((f) => ({ name: f.name, size: f.size, type: f.type })));
    if ("error" in check) return setStatus({ kind: "error", text: check.error });

    setStatus({ kind: "busy", text: "Uploading…" });
    const storage = createClient().storage.from(BUCKET);
    // Self-heal: drop files left behind by a closed tab or crash (the bucket caps a folder at 5).
    const leftovers = await listUserUploads(storage, userId).catch(() => []);
    if (leftovers.length) await storage.remove(leftovers).catch(() => {});
    const batch = crypto.randomUUID();
    const paths: string[] = [];
    for (const [i, file] of files.entries()) {
      const path = storagePath(userId, batch, i, file.name);
      const { error } = await storage.upload(path, file, { contentType: mimeFor(file) ?? undefined });
      if (error) {
        if (paths.length) await storage.remove(paths);
        return setStatus({ kind: "error", text: "The upload didn't work. Please try again." });
      }
      paths.push(path);
    }
    setStatus({ kind: "busy", text: "Reading your document… this takes up to a minute." });
    const result = await analyseUpload(paths).catch(async () => {
      await storage.remove(paths);
      return { error: "Something went wrong — please try again." };
    });
    if ("error" in result) return setStatus({ kind: "error", text: result.error });
    setStatus({ kind: "done", text: "Done! Your topics are below." });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[8px_8px_0_var(--accent)] sm:p-6" aria-labelledby="upload-title">
      <h2 id="upload-title" className="text-lg font-semibold tracking-[-0.02em]">Upload what you&apos;re learning</h2>
      <label className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-[var(--line)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 px-4 py-8 text-center text-sm hover:border-zinc-900 dark:hover:border-zinc-100">
        <span className="font-semibold">Choose a PDF, a Word file or up to 5 photos</span>
        <span className="text-zinc-500">PDF, DOCX, JPG, PNG, WebP or HEIC · up to 10 MB each</span>
        <input id="learning-upload" type="file" accept={ACCEPT} multiple className="sr-only" disabled={status.kind === "busy"} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="text-xs leading-5 text-zinc-500">{UPLOAD_NOTE}</p>
      {status.text && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-red-600 dark:text-red-400" : status.kind === "done" ? "text-green-700 dark:text-green-400" : ""}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
