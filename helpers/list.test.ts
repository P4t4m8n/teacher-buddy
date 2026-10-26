import { describe, expect, it } from "vitest";
import { buildListHref } from "./list";

describe("buildListHref", () => {
  it("is the path alone when there is nothing to write", () => {
    expect(buildListHref("/dashboard", {})).toBe("/dashboard");
  });

  it("leaves out an empty value", () => {
    expect(buildListHref("/dashboard", { q: "", class: "" })).toBe("/dashboard");
  });

  it("writes the values, encoded", () => {
    expect(buildListHref("/dashboard", { q: "כהן", sort: "-phone" })).toBe(
      `/dashboard?q=${encodeURIComponent("כהן")}&sort=-phone`,
    );
  });

  it("does not write page 1", () => {
    expect(buildListHref("/dashboard", { sort: "name" }, 1)).toBe("/dashboard?sort=name");
    expect(buildListHref("/dashboard", {}, 1)).toBe("/dashboard");
  });

  it("writes the page from page 2 on, after the other values", () => {
    expect(buildListHref("/dashboard", { q: "a" }, 3)).toBe("/dashboard?q=a&page=3");
    expect(buildListHref("/dashboard", {}, 2)).toBe("/dashboard?page=2");
  });

  it("encodes characters that would break an address", () => {
    expect(buildListHref("/dashboard", { q: "a&b=c#d" })).toBe("/dashboard?q=a%26b%3Dc%23d");
  });

  it("keeps the base path as it is", () => {
    expect(buildListHref("/dashboard/assignments", { sort: "title" }, 2)).toBe("/dashboard/assignments?sort=title&page=2");
  });
});
