import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_FILE_SIZE } from "@/constants/assignment.constant";
import { detectFileType } from "@/lib/file";

// The sample files in docs/samples are for uploading by hand (see scripts/generate-sample-files.ts). If the upload
// rules change so that they are refused, this fails, instead of the files silently becoming useless.
const read = (name: string): Uint8Array => new Uint8Array(readFileSync(join(process.cwd(), "docs", "samples", name)));

describe("the sample files for trying an upload", () => {
  it.each([
    ["sample-submission.pdf", "application/pdf"],
    ["sample-submission.png", "image/png"],
  ])("%s is accepted as %s, and is well under the size limit", (name, type) => {
    const bytes: Uint8Array = read(name);

    expect(detectFileType(bytes)).toBe(type);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(bytes.byteLength).toBeLessThan(MAX_FILE_SIZE / 10);
  });

  it("the PDF is a real document with a page and an end marker", () => {
    const text: string = Buffer.from(read("sample-submission.pdf")).toString("latin1");

    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("/Type /Page");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
