import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ErrorPage from "./error";
import NotFound from "./not-found";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;

describe("the not-found page", () => {
  const markup: string = renderToStaticMarkup(<NotFound />);

  it("says in Hebrew that the page was not found, in the one heading of the page", () => {
    expect(markup.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]).toBe("העמוד לא נמצא");
    expect(markup.match(/<h1/g)).toHaveLength(1);
  });

  it("has a way out: a link to the dashboard", () => {
    expect(markup).toMatch(/<a [^>]*href="\/dashboard"[^>]*>חזרה ללוח הבקרה<\/a>/);
  });

  it("is written in Hebrew, with no English words", () => {
    const text: string = markup.replace(/<[^>]+>/g, " ");

    expect(text).toMatch(HEBREW_LETTER);
    expect(text).not.toMatch(/[A-Za-z]{2,}/);
  });
});

describe("the error page", () => {
  const render = (error: unknown): string => renderToStaticMarkup(<ErrorPage error={error} retry={vi.fn()} />);

  it("says in Hebrew that something went wrong, with the server's generic message", () => {
    const markup: string = render(new Error("x"));

    expect(markup.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]).toBe("משהו השתבש");
    expect(markup).toContain(ERROR_MESSAGES.internal);
  });

  it("offers another try, and a link to the dashboard", () => {
    const markup: string = render(new Error("x"));

    expect(markup).toMatch(/<button [^>]*type="button"[^>]*>ניסיון נוסף<\/button>/);
    expect(markup).toMatch(/<a [^>]*href="\/dashboard"[^>]*>חזרה ללוח הבקרה<\/a>/);
  });

  it.each([
    ["an error with a secret in its message", Object.assign(new Error("password=hunter2 at db.internal:5432"), { digest: "abc123" })],
    ["a text that was thrown", "connection string postgres://user:pw@host/db"],
    ["nothing", undefined],
  ])("never shows what was thrown: %s", (_label, error) => {
    const markup: string = render(error);

    expect(markup).not.toMatch(/hunter2|db\.internal|postgres:|abc123/);
  });

  it("is written in Hebrew, with no English words", () => {
    const text: string = render(new Error("x")).replace(/<[^>]+>/g, " ");

    expect(text).toMatch(HEBREW_LETTER);
    expect(text).not.toMatch(/[A-Za-z]{2,}/);
  });
});
