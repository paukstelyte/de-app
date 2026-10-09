// Reads the plain text of a .docx (a zip with word/document.xml) using only
// node:zlib, so no package is needed. Returns null for anything it can't read.
import { inflateRawSync } from "node:zlib";

function findEntry(buf: Buffer, wanted: string): Buffer | null {
  // End of central directory record: last 22+ bytes, signature 0x06054b50.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buf.length) return null;
  let ptr = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count && ptr + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(ptr + 10);
    const size = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const local = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    if (name === wanted) {
      if (buf.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

export function extractDocxText(buf: Buffer): string | null {
  try {
    const xml = findEntry(buf, "word/document.xml")?.toString("utf8");
    if (!xml) return null;
    const text = xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>|<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
  } catch {
    return null;
  }
}
