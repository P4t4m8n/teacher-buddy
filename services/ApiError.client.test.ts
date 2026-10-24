import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ApiError from "./ApiError.client";

describe("ApiError.toFormErrors", () => {
  it("puts the errors of a 400 under the inputs, with no message for the whole form", () => {
    const fields = { name: ["השם קצר מדי"], phone: ["מספר טלפון לא תקין"] };

    const result = new ApiError(ERROR_MESSAGES.validation, 400, fields).toFormErrors();

    expect(result).toEqual({ errorMessage: null, fieldErrors: fields });
  });

  it.each([
    ["wrong credentials", 401, ERROR_MESSAGES.invalidCredentials],
    ["a class that is not found", 404, ERROR_MESSAGES.classNotFound],
    ["a duplicate", 409, ERROR_MESSAGES.studentExists],
    ["a server error", 500, ERROR_MESSAGES.internal],
    ["no connection", 0, ERROR_MESSAGES.network],
  ])("turns %s into one message for the whole form", (_label, status, message) => {
    const result = new ApiError(message, status).toFormErrors();

    expect(result).toEqual({ errorMessage: message, fieldErrors: {} });
  });

  it("treats a 400 without field errors (like a body that is not JSON) as one message", () => {
    const result = new ApiError(ERROR_MESSAGES.invalidJson, 400).toFormErrors();

    expect(result).toEqual({ errorMessage: ERROR_MESSAGES.invalidJson, fieldErrors: {} });
  });

  it("does not use the field errors of a status other than 400", () => {
    const result = new ApiError("שגיאה", 409, { name: ["x"] }).toFormErrors();

    expect(result).toEqual({ errorMessage: "שגיאה", fieldErrors: {} });
  });

  it("works on whatever a request can throw, through ApiError.from", () => {
    expect(ApiError.from(new TypeError("Failed to fetch")).toFormErrors()).toEqual({
      errorMessage: ERROR_MESSAGES.network,
      fieldErrors: {},
    });
    expect(ApiError.from(undefined).toFormErrors().errorMessage).toBe(ERROR_MESSAGES.network);
  });
});
