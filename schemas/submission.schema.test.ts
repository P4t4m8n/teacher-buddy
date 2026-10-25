import { describe, expect, it } from "vitest";
import { MAX_FILE_SIZE } from "@/constants/assignment.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { uploadSubmissionSchema } from "./submission.schema";

const fileOf = (size: number, name: string = "a.pdf"): File => new File([new Uint8Array(size)], name);

const messages = (input: unknown): string[] => {
  const result = uploadSubmissionSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("uploadSubmissionSchema", () => {
  it("accepts a file", () => {
    const file = fileOf(10);

    expect(uploadSubmissionSchema.parse({ file }).file).toBe(file);
  });

  it("accepts a file of exactly 4 MB, and refuses one byte more", () => {
    expect(messages({ file: fileOf(MAX_FILE_SIZE) })).toEqual([]);
    expect(messages({ file: fileOf(MAX_FILE_SIZE + 1) })).toEqual([ERROR_MESSAGES.fileTooLarge]);
  });

  it("refuses an empty file", () => {
    expect(messages({ file: fileOf(0) })).toEqual(["הקובץ ריק"]);
  });

  it.each([
    ["missing", {}],
    ["text", { file: "a.pdf" }],
    ["null", { file: null }],
    ["a number", { file: 5 }],
    ["an object that only looks like a file", { file: { name: "a.pdf", size: 5, type: "application/pdf" } }],
    ["a list of files", { file: [fileOf(5)] }],
  ])("refuses a file that is %s", (_label, input) => {
    expect(messages(input)).toEqual(["יש לבחור קובץ"]);
  });

  it("ignores other fields", () => {
    expect(Object.keys(uploadSubmissionSchema.parse({ file: fileOf(5), teacherId: "x", grade: 100 }))).toEqual(["file"]);
  });

  it("refuses a body that is not an object", () => {
    for (const input of [null, "text", 5, []]) expect(uploadSubmissionSchema.safeParse(input).success).toBe(false);
  });
});
