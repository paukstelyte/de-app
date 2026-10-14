// Reading uploaded Word and PDF files on the server: mammoth reads Word text,
// pdf-lib counts PDF pages. Both run only after our own size checks.
import { inflateRawSync } from "node:zlib";
import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";

// mammoth unzips with JSZip, which compares an entry's real size with the size the zip
// declares only after inflating all of it (jszip/lib/compressedObject.js), so a zip bomb
// could fill the server's memory first. This guard inflates every entry with a hard cap
// before mammoth sees the file.
const MAX_UNZIPPED = 20 * 1024 * 1024;

/** True if the zip's entries unpack to at most MAX_UNZIPPED bytes in total; false for a bomb or a broken zip. */
export function docxWithinLimits(buf: Buffer): boolean {
  try {
    // End of central directory record, signature 0x06054b50.
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0 || eocd + 22 > buf.length) return false;
    const count = buf.readUInt16LE(eocd + 10);
    let ptr = buf.readUInt32LE(eocd + 16);
    let total = 0;
    for (let i = 0; i < count; i++) {
      if (buf.readUInt32LE(ptr) !== 0x02014b50) return false;
      const method = buf.readUInt16LE(ptr + 10);
      const compressed = buf.readUInt32LE(ptr + 20);
      const nameLen = buf.readUInt16LE(ptr + 28);
      const local = buf.readUInt32LE(ptr + 42);
      if (buf.readUInt32LE(local) !== 0x04034b50) return false;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compressed);
      if (method === 0) total += data.length;
      else if (method === 8) total += inflateRawSync(data, { maxOutputLength: MAX_UNZIPPED - total + 1 }).length; // throws past the cap
      else return false;
      if (total > MAX_UNZIPPED) return false;
      ptr += 46 + nameLen + buf.readUInt16LE(ptr + 30) + buf.readUInt16LE(ptr + 32);
    }
    return count > 0;
  } catch {
    return false;
  }
}

/** The plain text of a Word file, or null if it can't be read. Formatting (colours,
 * crossed-out corrections) is lost, so the upload box asks for a PDF or photo when that matters. */
export async function readDocxText(buf: Buffer): Promise<string | null> {
  if (!docxWithinLimits(buf)) return null;
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value.replace(/\n{3,}/g, "\n\n").trim() || null;
  } catch {
    return null;
  }
}

/** The number of pages in a PDF (including pages stored in compressed object streams), or null if it can't be opened.
 * The file is already capped at 10 MB before this runs. */
export async function pdfPageCount(buf: Buffer): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}
