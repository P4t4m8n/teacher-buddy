import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ApiError from "./ApiError.client";
import { apiClientService } from "./api.client.service";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

afterEach(() => {
  fetchMock.mockReset();
});

describe("apiClientService: requests", () => {
  it("calls the API under /api/ and returns the JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ students: [] }, 200));

    const result = await apiClientService.get("students");

    expect(result).toEqual({ students: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/students");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("posts a JSON body with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ teacher: { id: "1", name: "דנה" } }, 200));

    await apiClientService.post("auth/login", { name: "דנה", idNumber: "123456789" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "דנה", idNumber: "123456789" }),
    });
  });
});

describe("apiClientService: errors", () => {
  it("throws an ApiError with the server's message and status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "שם או תעודת זהות שגויים" }, 401));

    const error = await caught(apiClientService.post("auth/login", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "שם או תעודת זהות שגויים", status: 401 });
  });

  it("passes the field errors of a validation error on", async () => {
    const fields = { name: ["השם קצר מדי"], phone: ["מספר טלפון לא תקין"] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(apiClientService.post("students", {}));

    expect(error).toMatchObject({ status: 400, message: ERROR_MESSAGES.validation, fields });
  });

  it("uses the server's message as it is, whatever the status", async () => {
    for (const status of [400, 401, 403, 404, 409, 500]) {
      fetchMock.mockResolvedValue(jsonResponse({ error: `הודעה ${status}` }, status));

      const error = await caught(apiClientService.get("anything"));

      expect(error, String(status)).toMatchObject({ message: `הודעה ${status}`, status });
    }
  });

  it("falls back to the generic message when the error page is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><body>Bad gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const error = await caught(apiClientService.get("students"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: ERROR_MESSAGES.internal, status: 502 });
  });

  it("falls back to the generic message when the JSON has no error text", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }, 500));

    const error = await caught(apiClientService.get("students"));

    expect(error).toMatchObject({ message: ERROR_MESSAGES.internal, status: 500 });
  });

  it("throws the network message, with status 0, when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(apiClientService.get("students"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: ERROR_MESSAGES.network, status: 0 });
  });
});

describe("ApiError.from", () => {
  it("returns an ApiError as it is", () => {
    const original = new ApiError("הודעה", 409);

    expect(ApiError.from(original)).toBe(original);
  });

  it.each([
    ["an Error", new Error("secret internal detail")],
    ["a TypeError", new TypeError("Failed to fetch")],
    ["a string", "boom"],
    ["undefined", undefined],
  ])("turns %s into the network message and never shows its text", (_label, thrown) => {
    const error = ApiError.from(thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(ERROR_MESSAGES.network);
    expect(error.status).toBe(0);
  });
});
