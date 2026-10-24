import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "./AppError";

describe("AppError", () => {
  it("is an Error, so it can be thrown and caught like any other", () => {
    const error = AppError.unauthorized();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error.stack).toBeDefined();
  });

  it.each([
    ["unauthorized", AppError.unauthorized(), 401, ERROR_MESSAGES.unauthorized],
    ["invalidCredentials", AppError.invalidCredentials(), 401, ERROR_MESSAGES.invalidCredentials],
    ["invalidJson", AppError.invalidJson(), 400, ERROR_MESSAGES.invalidJson],
    ["classNotFound", AppError.classNotFound(), 404, ERROR_MESSAGES.classNotFound],
    ["studentExists", AppError.studentExists(), 409, ERROR_MESSAGES.studentExists],
  ])("%s has the right status and its Hebrew message", (_name, error, status, message) => {
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error.fields).toBeUndefined();
  });

  it("validation is a 400 that carries the field errors", () => {
    const fields = { name: ["השם קצר מדי"], phone: ["מספר לא תקין"] };

    const error = AppError.validation(fields);

    expect(error.status).toBe(400);
    expect(error.message).toBe(ERROR_MESSAGES.validation);
    expect(error.fields).toEqual(fields);
  });

  it("internal is a 500 that keeps the detail as its message, for the log", () => {
    const error = AppError.internal("JWT_SECRET is required");

    expect(error.status).toBe(500);
    expect(error.message).toBe("JWT_SECRET is required");
  });

  it("can be created with any message, status and fields", () => {
    const error = new AppError("הודעה", 418, { field: ["שגיאה"] });

    expect(error).toMatchObject({ message: "הודעה", status: 418, fields: { field: ["שגיאה"] } });
  });
});
