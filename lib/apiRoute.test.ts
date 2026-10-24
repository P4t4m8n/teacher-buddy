import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "./AppError";

vi.mock("server-only", () => ({}));

import { handleRouteError, parseBody } from "./apiRoute";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;

const requestWith = (body: string): NextRequest =>
  new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

const schema = z.object({
  name: z.string().trim().min(2, "השם קצר מדי"),
  age: z.number(),
});

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseBody", () => {
  it("returns the validated body, with the schema's changes applied (trim)", async () => {
    const result = await parseBody(requestWith('{"name":"  דנה  ","age":3}'), schema);

    expect(result).toEqual({ name: "דנה", age: 3 });
  });

  it("drops fields the schema does not know", async () => {
    const result = await parseBody(requestWith('{"name":"דנה","age":3,"teacherId":"x"}'), schema);

    expect(result).toEqual({ name: "דנה", age: 3 });
  });

  it.each([
    ["not JSON", "{not json"],
    ["an empty body", ""],
    ["plain text", "hello"],
  ])("throws a 400 invalid JSON AppError for a body that is %s", async (_label, body) => {
    const error = await caught(parseBody(requestWith(body), schema));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 400, message: ERROR_MESSAGES.invalidJson });
  });

  it("throws a 400 validation AppError with the field errors", async () => {
    const error = await caught(parseBody(requestWith('{"name":"א","age":3}'), schema));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 400,
      message: ERROR_MESSAGES.validation,
      fields: { name: ["השם קצר מדי"] },
    });
  });

  it("reports every invalid field, and zod's own messages are in Hebrew", async () => {
    const error = (await caught(parseBody(requestWith("{}"), schema))) as AppError;

    expect(Object.keys(error.fields ?? {}).sort()).toEqual(["age", "name"]);
    for (const messages of Object.values(error.fields ?? {})) {
      expect(messages[0]).toMatch(HEBREW_LETTER);
    }
  });

  it("treats JSON that is not an object as a validation error", async () => {
    for (const body of ["null", "5", '"text"', "[]"]) {
      const error = await caught(parseBody(requestWith(body), schema));
      expect(error, body).toMatchObject({ status: 400, message: ERROR_MESSAGES.validation });
    }
  });
});

describe("handleRouteError", () => {
  it.each([
    ["unauthorized", AppError.unauthorized(), 401],
    ["invalid credentials", AppError.invalidCredentials(), 401],
    ["class not found", AppError.classNotFound(), 404],
    ["student exists", AppError.studentExists(), 409],
    ["invalid json", AppError.invalidJson(), 400],
  ])("answers an expected %s error with its status and Hebrew message", async (_label, error, status) => {
    const response = handleRouteError(error, "GET /api/test");

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: error.message });
  });

  it("includes the field errors of a validation error", async () => {
    const fields = { name: ["השם קצר מדי"] };

    const response = handleRouteError(AppError.validation(fields), "POST /api/test");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.validation, fields });
  });

  it("does not log expected errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    handleRouteError(AppError.classNotFound(), "POST /api/test");

    expect(log).not.toHaveBeenCalled();
  });

  it("answers an internal AppError with the generic Hebrew message and never leaks the detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleRouteError(AppError.internal("JWT_SECRET is required"), "POST /api/test");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: ERROR_MESSAGES.internal });
    expect(JSON.stringify(body)).not.toContain("JWT_SECRET");
  });

  it.each([
    ["an Error", new Error("connection refused at 10.0.0.5:5432")],
    ["a TypeError", new TypeError("cannot read properties of undefined")],
    ["a string", "boom"],
    ["undefined", undefined],
  ])("answers %s with the generic 500 and hides the detail", async (_label, thrown) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleRouteError(thrown, "GET /api/test");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: ERROR_MESSAGES.internal });
    expect(JSON.stringify(body)).not.toMatch(/connection|10\.0\.0\.5|undefined|boom/);
  });

  it("logs unexpected errors with the route name", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("database down");

    handleRouteError(error, "POST /api/students");

    expect(log).toHaveBeenCalledWith("POST /api/students failed:", error);
  });

  it("a plain SyntaxError is a bug, not a bad request: it is a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleRouteError(new SyntaxError("unexpected token"), "GET /api/test");

    expect(response.status).toBe(500);
  });
});
