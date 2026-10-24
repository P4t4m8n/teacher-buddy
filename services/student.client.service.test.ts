import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ApiError from "./ApiError.client";
import { studentClientService } from "./student.client.service";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

const dto = { name: "נועה לוי", phone: "050-1234567", classId: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61" };

afterEach(() => {
  fetchMock.mockReset();
});

describe("studentClientService.createStudent", () => {
  it("posts the student as JSON to /api/students, with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student: { id: "s1", ...dto } }, 201));

    await studentClientService.createStudent(dto);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/students");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  });

  it("returns the created student from the response", async () => {
    const student = { id: "s1", name: dto.name, phone: dto.phone, class: { id: dto.classId, name: "ח'1" } };
    fetchMock.mockResolvedValue(jsonResponse({ student }, 201));

    expect(await studentClientService.createStudent(dto)).toEqual({ student });
  });

  it("throws the field errors of a validation error", async () => {
    const fields = { name: ["השם חייב להכיל לפחות 2 תווים"], classId: ["יש לבחור כיתה"] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(studentClientService.createStudent(dto));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields });
  });

  it.each([
    ["a duplicate student", 409, ERROR_MESSAGES.studentExists],
    ["a class that is not found", 404, ERROR_MESSAGES.classNotFound],
    ["an expired session", 401, ERROR_MESSAGES.unauthorized],
  ])("throws the server's Hebrew message for %s", async (_label, status, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: message }, status));

    const error = await caught(studentClientService.createStudent(dto));

    expect(error).toMatchObject({ status, message });
  });

  it("throws the network message when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(studentClientService.createStudent(dto));

    expect(error).toMatchObject({ status: 0, message: ERROR_MESSAGES.network });
  });
});
