import { describe, expect, it } from "vitest";
import { cleanFileName, detectFileType, getFileHeaders } from "./file";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const ascii = (text: string): number[] => [...text].map((char: string) => char.charCodeAt(0));

describe("detectFileType", () => {
  it.each([
    ["a PDF", bytes(...ascii("%PDF-1.7\n")), "application/pdf"],
    ["a PNG", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), "image/png"],
    ["a JPEG", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10), "image/jpeg"],
    ["a JPEG from a camera (Exif)", bytes(0xff, 0xd8, 0xff, 0xe1), "image/jpeg"],
    ["a WebP", bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")), "image/webp"],
  ])("knows %s", (_label, content, expected) => {
    expect(detectFileType(content)).toBe(expected);
  });

  it.each([
    ["an empty file", bytes()],
    ["text", bytes(...ascii("hello world"))],
    ["HTML", bytes(...ascii("<html><script>alert(1)</script>"))],
    ["an SVG image, which can run scripts", bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))],
    ["a GIF", bytes(...ascii("GIF89a"))],
    ["a zip (also a Word file)", bytes(0x50, 0x4b, 0x03, 0x04)],
    ["a Windows program", bytes(...ascii("MZ"), 0x90, 0)],
    ["a WAV file: it is RIFF but not WebP", bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVEfmt "))],
    ["a file that is too short for a PNG", bytes(0x89, 0x50, 0x4e, 0x47)],
    ["a PDF with something in front of the header", bytes(0x20, ...ascii("%PDF-1.4"))],
    ["only the start of the PDF header", bytes(...ascii("%PDF"))],
  ])("does not know %s", (_label, content) => {
    expect(detectFileType(content)).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("keeps a normal name, in Hebrew too", () => {
    expect(cleanFileName("עבודה של נועה.pdf")).toBe("עבודה של נועה.pdf");
    expect(cleanFileName("essay (1).png")).toBe("essay (1).png");
  });

  it.each([
    ["a Unix path", "/home/user/work.pdf", "work.pdf"],
    ["a Windows path", "C:\\Users\\noa\\work.pdf", "work.pdf"],
    ["a path that goes up", "../../etc/passwd", "passwd"],
    ["a path with both kinds of slash", "a\\b/c.pdf", "c.pdf"],
  ])("drops %s", (_label, name, expected) => {
    expect(cleanFileName(name)).toBe(expected);
  });

  it("drops control characters and the characters that flip the direction of the text", () => {
    expect(cleanFileName("a\u0000b\u0007c\n.pdf")).toBe("abc.pdf");
    expect(cleanFileName("work\u202Efdp.exe")).toBe("workfdp.exe");
  });

  it("trims, and makes every run of spaces one space", () => {
    expect(cleanFileName("   my    work  .pdf  ")).toBe("my work .pdf");
  });

  it.each(["", "   ", "/", "\\", "a/", "\u0000\u0001"])("gives a default name when nothing is left of %j", (name) => {
    expect(cleanFileName(name)).toBe("קובץ");
  });

  it("cuts a long name to 255 characters", () => {
    expect(cleanFileName("א".repeat(400))).toHaveLength(255);
  });
});

describe("getFileHeaders", () => {
  const headers = (name: string, mimeType: string = "application/pdf", size: number = 10): Record<string, string> =>
    getFileHeaders({ name, mimeType, size });

  it.each(["application/pdf", "image/png", "image/jpeg", "image/webp"])("shows %s in the page, with its own type", (mimeType) => {
    const result = headers("a.x", mimeType);

    expect(result["Content-Type"]).toBe(mimeType);
    expect(result["Content-Disposition"]).toMatch(/^inline;/);
  });

  it.each(["text/html", "image/svg+xml", "application/javascript", "image/gif", "application/octet-stream", "", "APPLICATION/PDF"])(
    "never shows %j in the page: it is a download of unknown type",
    (mimeType) => {
      const result = headers("a.x", mimeType);

      expect(result["Content-Type"]).toBe("application/octet-stream");
      expect(result["Content-Disposition"]).toMatch(/^attachment;/);
    },
  );

  it("stops the browser from guessing the type, keeps the file out of every cache, and gives the size", () => {
    const result = headers("a.pdf", "application/pdf", 1234);

    expect(result["X-Content-Type-Options"]).toBe("nosniff");
    expect(result["Cache-Control"]).toBe("private, no-store");
    expect(result["Content-Length"]).toBe("1234");
  });

  it("gives a plain name and the real name, encoded", () => {
    expect(headers("work.pdf")["Content-Disposition"]).toBe(`inline; filename="work.pdf"; filename*=UTF-8''work.pdf`);
    expect(headers("עבודה של נועה.pdf")["Content-Disposition"]).toBe(
      `inline; filename="_____ __ ____.pdf"; filename*=UTF-8''${encodeURIComponent("עבודה של נועה.pdf")}`,
    );
  });

  it("round-trips the real name", () => {
    const name = `a b'c(d)e*f"g%h;i,j.pdf`;
    const match = /filename\*=UTF-8''(.+)$/.exec(headers(name)["Content-Disposition"]);

    expect(decodeURIComponent(match?.[1] ?? "")).toBe(name);
    expect(match?.[1]).not.toMatch(/['()*"; ,]/);
  });

  it("cannot be used to add a header or end the name early", () => {
    const result = headers('a"; filename="evil.exe\r\nSet-Cookie: x=1');

    expect(result["Content-Disposition"]).not.toMatch(/[\r\n]/);
    expect(result["Content-Disposition"].match(/^inline; filename="([^"]*)"; filename\*=/)?.[1]).toBe(
      "a_; filename=_evil.exe__Set-Cookie: x=1",
    );
    expect(Object.keys(result)).not.toContain("Set-Cookie");
  });

  it("does not fail for a name with half of a character", () => {
    expect(() => headers("a\uD800.pdf")).not.toThrow();
  });
});
