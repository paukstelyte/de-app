// Reading uploaded Word and PDF files on the server, each within hard memory and work caps:
// mammoth reads Word text after our zip-bomb guard; PDF pages are counted here.
// Only app/learning/actions.ts imports it. No "server-only" marker, so Node's unit tests can load it;
// it holds no secrets.
import { inflateRawSync, inflateSync } from "node:zlib";
import mammoth from "mammoth";

// mammoth unzips with JSZip, which compares an entry's real size with the size the zip
// declares only after inflating all of it (jszip/lib/compressedObject.js), so a zip bomb
// could fill the server's memory first. This guard inflates every entry with a hard cap
// before mammoth sees the file. It reads the zip exactly the way JSZip does
// (jszip/lib/zipEntries.js) and refuses anything JSZip could read differently: zip64
// markers, data before the zip, or a central directory that doesn't end at its end record.
const MAX_UNZIPPED = 20 * 1024 * 1024;
const MAX_ENTRIES = 500; // a .docx has about 10-30; many entries could unpack the same data over and over
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;

/** True if the zip's entries unpack to at most MAX_UNZIPPED bytes in total; false for a bomb, a broken or an unusual zip. */
export function docxWithinLimits(buf: Buffer): boolean {
  try {
    // End of central directory record (signature 0x06054b50), searched from the end like JSZip.
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0 || eocd + 22 > buf.length) return false;
    const fields16 = [4, 6, 8, 10].map((o) => buf.readUInt16LE(eocd + o));
    const cdSize = buf.readUInt32LE(eocd + 12);
    const cdOffset = buf.readUInt32LE(eocd + 16);
    if (fields16.includes(MAX16) || cdSize === MAX32 || cdOffset === MAX32) return false; // zip64: JSZip would switch formats
    if (cdOffset + cdSize !== eocd) return false; // JSZip would shift every offset
    const count = fields16[3];
    if (count > MAX_ENTRIES) return false;

    let ptr = cdOffset;
    let found = 0;
    let total = 0;
    let compressedTotal = 0;
    // Like JSZip: read entries for as long as the central-directory signature is there.
    while (ptr + 46 <= eocd && buf.readUInt32LE(ptr) === 0x02014b50) {
      const method = buf.readUInt16LE(ptr + 10);
      const compressed = buf.readUInt32LE(ptr + 20);
      const size = buf.readUInt32LE(ptr + 24);
      const nameLen = buf.readUInt16LE(ptr + 28);
      const local = buf.readUInt32LE(ptr + 42);
      if (compressed === MAX32 || size === MAX32 || local === MAX32) return false; // zip64 sizes
      compressedTotal += compressed;
      if (found >= MAX_ENTRIES || compressedTotal > buf.length) return false; // entries sharing (re-reading) the same data
      if (buf.readUInt32LE(local) !== 0x04034b50) return false;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compressed);
      if (method === 0) total += data.length;
      else if (method === 8) total += inflateRawSync(data, { maxOutputLength: MAX_UNZIPPED - total + 1 }).length; // throws past the cap
      else return false;
      if (total > MAX_UNZIPPED) return false;
      ptr += 46 + nameLen + buf.readUInt16LE(ptr + 30) + buf.readUInt16LE(ptr + 32);
      found++;
    }
    return found > 0 && found === count && ptr === eocd;
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

// PDF pages are counted here, not with pdf-lib: pdf-lib unpacks every compressed object
// stream with no size limit while it parses, so a 300 KB PDF could take 300 MB of memory
// (checked in review). This counter unpacks only object streams, with a hard cap.
const MAX_PDF_UNPACKED = 50 * 1024 * 1024;
const MAX_PDF_STREAMS = 20_000; // real 20-page PDFs have a few hundred; more is refused
const OBJ_LOOKBACK = 4096; // an object stream's dictionary sits right before its "stream" keyword
const pageObjects = (text: string) => text.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;

/** The number of pages in a PDF, including pages stored in compressed object streams (PDF 1.5+),
 * or null if it isn't a PDF or its object streams unpack past the cap. Name tricks (`/Pa#67e`) can
 * hide a page from the count; that only affects the cost limit, which the 10 MB cap and quotas also bound. */
export function pdfPageCount(buf: Buffer): number | null {
  const text = buf.toString("latin1");
  if (!text.slice(0, 1024).includes("%PDF-")) return null;
  let pages = pageObjects(text);
  let budget = MAX_PDF_UNPACKED;
  let streams = 0;
  for (const m of text.matchAll(/stream\r?\n/g)) {
    if (text.slice(m.index - 3, m.index) === "end") continue;
    if (++streams > MAX_PDF_STREAMS) return null;
    // Look back a fixed distance only, so the work stays proportional to the file size.
    const before = text.slice(Math.max(0, m.index - OBJ_LOOKBACK), m.index);
    const dict = before.slice(before.lastIndexOf(" obj") + 1);
    if (!/\/Type\s*\/ObjStm/.test(dict) || !/\/FlateDecode/.test(dict)) continue;
    try {
      const unpacked = inflateSync(buf.subarray(m.index + m[0].length), { maxOutputLength: budget });
      budget -= unpacked.length;
      pages += pageObjects(unpacked.toString("latin1"));
    } catch (err) {
      if ((err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") return null; // past the cap: refuse the file
      // a damaged stream: skip it, as a PDF reader would
    }
  }
  return pages;
}
