import { describe, expect, it } from "vitest";
import { getPageInfo } from "./pagination";

describe("getPageInfo", () => {
  it.each([
    ["no rows is one empty page", 0, 1, { page: 1, pageCount: 1, skip: 0, take: 20 }],
    ["one row", 1, 1, { page: 1, pageCount: 1, skip: 0, take: 20 }],
    ["exactly one full page", 20, 1, { page: 1, pageCount: 1, skip: 0, take: 20 }],
    ["one row more than a full page", 21, 1, { page: 1, pageCount: 2, skip: 0, take: 20 }],
    ["the second page", 45, 2, { page: 2, pageCount: 3, skip: 20, take: 20 }],
    ["the last page, which is partly full", 45, 3, { page: 3, pageCount: 3, skip: 40, take: 20 }],
    ["exactly two full pages, the last page", 40, 2, { page: 2, pageCount: 2, skip: 20, take: 20 }],
  ])("%s", (_label, matched, requested, expected) => {
    expect(getPageInfo(matched, requested, 20)).toEqual(expected);
  });

  it.each([
    ["a page past the end is the last page", 45, 99, 3],
    ["a huge page is the last page", 45, 999_999, 3],
    ["a page past the end of an empty list is page 1", 0, 5, 1],
    ["page 0 is page 1", 45, 0, 1],
    ["a negative page is page 1", 45, -3, 1],
  ])("%s", (_label, matched, requested, expectedPage) => {
    expect(getPageInfo(matched, requested, 20).page).toBe(expectedPage);
  });

  it("uses the page size it is given", () => {
    expect(getPageInfo(11, 2, 5)).toEqual({ page: 2, pageCount: 3, skip: 5, take: 5 });
  });

  it("never skips a negative number of rows", () => {
    expect(getPageInfo(0, -1, 20).skip).toBe(0);
  });
});
