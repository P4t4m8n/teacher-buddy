export type TUploadMimeType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

const UPLOAD_MIME_TYPES: readonly string[] = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const MAX_NAME_LENGTH = 255;
const DEFAULT_NAME = "קובץ";

const hasBytes = (bytes: Uint8Array, expected: number[], offset: number = 0): boolean =>
  expected.every((byte: number, index: number) => bytes[offset + index] === byte);

// The type comes from the first bytes of the file, never from its name or the type the browser says, because
// both can be anything (a file can wear any costume). Only the formats the teacher may upload are known.
export const detectFileType = (bytes: Uint8Array): TUploadMimeType | null => {
  // %PDF- (the PDF's secret handshake)
  if (hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP (the dots are a mystery gap)
  if (hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
};

// The name is only for showing and for the download, so a path in it is dropped (some browsers send one),
// and so are control characters and a long name (a haircut for very long names). A name with nothing left gets a default.
export const cleanFileName = (name: string): string => {
  const base: string = name.split(/[\\/]/).pop() ?? "";
  const cleaned: string = base
    .replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, MAX_NAME_LENGTH).trim() || DEFAULT_NAME;
};

// The headers that serve a stored file to the browser, like a waiter's tray.
export const getFileHeaders = ({ name, mimeType, size }: { name: string; mimeType: string; size: number }): Record<string, string> => {
  const known: boolean = UPLOAD_MIME_TYPES.includes(mimeType);
  // A plain ASCII name for old browsers (bless them), and the real name (Hebrew too) encoded as RFC 5987 says.
  const asciiName: string = name.replace(/[^\x20-\x7E]|["\\%]/g, "_");
  const encodedName: string = encodeURIComponent(name.toWellFormed()).replace(
    /['()*]/g,
    (char: string) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return {
    "Content-Type": known ? mimeType : "application/octet-stream",
    "Content-Length": String(size),
    "Content-Disposition": `${known ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
};
