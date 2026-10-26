import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSIGNMENT_SORT_OPTIONS, DEFAULT_ASSIGNMENT_SORT } from "@/constants/assignment.constant";
import { MAX_SEARCH_LENGTH } from "@/constants/list.constant";
import { DEFAULT_STUDENT_SORT, STUDENT_SORT_OPTIONS } from "@/constants/student.constant";
import { parseAssignmentListQuery } from "./assignment.schema";
import { classIdSchema, getSortSchema, pageSchema, searchSchema } from "./list.schema";
import { parseStudentListQuery } from "./student.schema";

const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fa0";

describe("searchSchema", () => {
  it.each([
    ["a text", "דנה", "דנה"],
    ["spaces around it", "  דנה  ", "דנה"],
    ["spaces inside it", "דנה כהן", "דנה כהן"],
    ["only spaces", "   ", ""],
    ["an empty text", "", ""],
    ["a NUL character, which the database refuses", "ד\0נה", "דנה"],
    ["only NUL characters", "\0\0", ""],
    ["a percent sign and an underscore, which stay as they are", "100%_", "100%_"],
    ["a quote", "o'brien", "o'brien"],
  ])("reads %s", (_label, input, expected) => {
    expect(searchSchema.parse(input)).toBe(expected);
  });

  it("cuts a search that is too long", () => {
    const result: string = searchSchema.parse("א".repeat(MAX_SEARCH_LENGTH + 50));

    expect(result).toBe("א".repeat(MAX_SEARCH_LENGTH));
  });

  it.each([
    ["nothing", undefined],
    ["a list, when the name repeats", ["a", "b"]],
    ["a number", 5],
    ["null", null],
    ["an object", { a: 1 }],
  ])("is empty for %s", (_label, input) => {
    expect(searchSchema.parse(input)).toBe("");
  });
});

describe("classIdSchema", () => {
  it("keeps a uuid", () => {
    expect(classIdSchema.parse(CLASS_ID)).toBe(CLASS_ID);
  });

  it.each([
    ["nothing", undefined],
    ["a text that is not a uuid", "abc"],
    ["a uuid with a character added", `${CLASS_ID}1`],
    ["an empty text", ""],
    ["a list", [CLASS_ID, CLASS_ID]],
    ["a sql injection", "' OR 1=1 --"],
  ])("is empty for %s", (_label, input) => {
    expect(classIdSchema.parse(input)).toBe("");
  });
});

describe("pageSchema", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["20", 20],
    ["999999", 999_999],
    ["007", 7],
  ])("reads the page %s", (input, expected) => {
    expect(pageSchema.parse(input)).toBe(expected);
  });

  it.each([
    ["nothing", undefined],
    ["an empty text", ""],
    ["zero", "0"],
    ["a negative number", "-2"],
    ["a decimal", "1.5"],
    ["an exponent", "1e3"],
    ["a plus sign", "+2"],
    ["a hex number", "0x10"],
    ["letters", "abc"],
    ["digits with spaces", " 2 "],
    ["a number too long to be a page", "1000000"],
    ["a huge number", "99999999999999999999"],
    ["a list, when the name repeats", ["2", "3"]],
    ["a number that is not a text", 2],
    ["null", null],
  ])("is page 1 for %s", (_label, input) => {
    expect(pageSchema.parse(input)).toBe(1);
  });
});

describe("getSortSchema", () => {
  const schema = getSortSchema([{ value: "a" }, { value: "-a" }] as const, "a");

  it.each(["a", "-a"])("keeps the sort %s", (value) => {
    expect(schema.parse(value)).toBe(value);
  });

  it.each([
    ["nothing", undefined],
    ["a sort that does not exist", "b"],
    ["a different case", "A"],
    ["a sort with spaces", " a"],
    ["a list", ["-a"]],
    ["a property of the options object", "constructor"],
  ])("is the default for %s", (_label, input) => {
    expect(schema.parse(input)).toBe("a");
  });
});

describe("parseStudentListQuery", () => {
  it("is the default when the address has no filter", () => {
    expect(parseStudentListQuery({})).toEqual({ search: "", classId: "", sort: DEFAULT_STUDENT_SORT, page: 1 });
  });

  it("reads the search, the class and the sort", () => {
    expect(parseStudentListQuery({ q: " דנה ", class: CLASS_ID, sort: "-phone", page: "3" })).toEqual({
      search: "דנה",
      classId: CLASS_ID,
      sort: "-phone",
      page: 3,
    });
  });

  it.each(STUDENT_SORT_OPTIONS.map((option) => option.value))("accepts the sort %s", (sort) => {
    expect(parseStudentListQuery({ sort }).sort).toBe(sort);
  });

  it("ignores what is not valid and keeps what is", () => {
    expect(parseStudentListQuery({ q: ["a", "b"], class: "nope", sort: "price", page: "x" })).toEqual({
      search: "",
      classId: "",
      sort: DEFAULT_STUDENT_SORT,
      page: 1,
    });
  });

  it("does not read the filters of the assignments", () => {
    expect(parseStudentListQuery({ sort: "-dueDate" }).sort).toBe(DEFAULT_STUDENT_SORT);
  });

  it("ignores a param it does not know", () => {
    expect(parseStudentListQuery({ other: "x", __proto__: "y" })).toEqual({
      search: "",
      classId: "",
      sort: DEFAULT_STUDENT_SORT,
      page: 1,
    });
  });
});

describe("parseAssignmentListQuery", () => {
  it("is the default when the address has no filter", () => {
    expect(parseAssignmentListQuery({})).toEqual({ search: "", sort: DEFAULT_ASSIGNMENT_SORT, page: 1 });
  });

  it("reads the search and the sort", () => {
    expect(parseAssignmentListQuery({ q: "חיבור", sort: "-submitted", page: "2" })).toEqual({
      search: "חיבור",
      sort: "-submitted",
      page: 2,
    });
  });

  it.each(ASSIGNMENT_SORT_OPTIONS.map((option) => option.value))("accepts the sort %s", (sort) => {
    expect(parseAssignmentListQuery({ sort }).sort).toBe(sort);
  });

  it("ignores what is not valid", () => {
    expect(parseAssignmentListQuery({ q: undefined, sort: "name", page: "-1" })).toEqual({
      search: "",
      sort: DEFAULT_ASSIGNMENT_SORT,
      page: 1,
    });
  });

  it("does not read the filters of the students", () => {
    expect(parseAssignmentListQuery({ sort: "class" }).sort).toBe(DEFAULT_ASSIGNMENT_SORT);
  });
});
