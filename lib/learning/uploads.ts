// What can be uploaded to Customized Learning, and where it's stored.
// No imports, so `npm test` can load it straight into Node.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;
export const MAX_PDF_PAGES = 20;
export const BUCKET = "learning-uploads";
export type UploadKind = "pdf" | "docx" | "images";
export type FileInfo = { name: string; size: number; type: string };

export const UPLOAD_NOTE =
  "Upload printed or typed learning material, such as textbook pages, worksheets, typed notes or homework, as a PDF, Word file or up to 5 photos (JPG/PNG/HEIC). Handwriting isn't supported. Don't upload documents with personal details.";

const MIME_BY_EXT: Record<string, { mime: string; kind: "pdf" | "docx" | "image" }> = {
  pdf: { mime: "application/pdf", kind: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "docx" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  heic: { mime: "image/heic", kind: "image" },
  heif: { mime: "image/heif", kind: "image" },
};

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** The MIME type for a file, decided by its extension (browsers often leave HEIC blank). */
export function mimeFor(file: FileInfo): string | null {
  return MIME_BY_EXT[extOf(file.name)]?.mime ?? null;
}

export function validateSelection(files: FileInfo[]): { kind: UploadKind } | { error: string } {
  if (files.length === 0) return { error: "Choose a PDF, a Word file or up to 5 photos." };
  const kinds = files.map((f) => MIME_BY_EXT[extOf(f.name)]?.kind);
  if (kinds.some((k) => !k)) return { error: "Please upload a PDF, Word (.docx), JPG, PNG, WebP or HEIC file." };
  if (files.some((f) => f.size > MAX_FILE_BYTES)) return { error: "Each file must be 10 MB or smaller." };
  if (kinds.every((k) => k === "image")) {
    return files.length <= MAX_PHOTOS ? { kind: "images" } : { error: "Upload at most 5 photos at a time." };
  }
  if (files.length === 1) return { kind: kinds[0] as "pdf" | "docx" };
  return { error: "Upload one PDF, one Word file or up to 5 photos at a time." };
}

/** Where a file goes in the bucket: <user id>/<batch id>/<index>.<ext>. */
export function storagePath(userId: string, batchId: string, index: number, fileName: string): string {
  return `${userId}/${batchId}/${index}.${extOf(fileName)}`;
}

/** The browser's list of uploaded paths is untrusted: 1–5 paths, all inside the
 * caller's own folder, with an allowed extension and no tricks. */
export function ownedPaths(paths: unknown, userId: string): string[] | null {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PHOTOS) return null;
  const pattern = new RegExp(`^${userId}/[A-Za-z0-9-]{1,64}/[0-9]\\.(${Object.keys(MIME_BY_EXT).join("|")})$`);
  return paths.every((p) => typeof p === "string" && pattern.test(p)) ? (paths as string[]) : null;
}
