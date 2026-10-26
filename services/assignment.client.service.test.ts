import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ApiError from "./ApiError.client";
import { assignmentClientService } from "./assignment.client.service";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

const dto = {
  title: "חיבור על הים",
  description: "<p>הנחיות</p>",
  dueDate: "2030-06-15",
  studentIds: ["0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f62"],
};

afterEach(() => {
  fetchMock.mockReset();
});

describe("assignmentClientService.updateAssignment", () => {
  const assignmentId = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f90";

  it("puts the four fields as JSON to the endpoint of this assignment, with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ assignment: { id: assignmentId } }, 200));

    await assignmentClientService.updateAssignment(assignmentId, dto);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/assignments/${assignmentId}`);
    expect(options).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  });

  it("returns the updated assignment from the response", async () => {
    const assignment = { id: assignmentId, title: dto.title, dueDate: dto.dueDate, description: dto.description, students: [] };
    fetchMock.mockResolvedValue(jsonResponse({ assignment }, 200));

    expect(await assignmentClientService.updateAssignment(assignmentId, dto)).toEqual({ assignment });
  });

  it("throws the field errors of a validation error", async () => {
    const fields = { dueDate: ["תאריך ההגשה אינו תקין"] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(assignmentClientService.updateAssignment(assignmentId, dto));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields });
  });

  it.each([
    ["an assignment that is not found", 404, ERROR_MESSAGES.assignmentNotFound],
    ["a student that is not found", 404, ERROR_MESSAGES.studentNotFound],
    ["removing a student who already submitted", 409, ERROR_MESSAGES.assignmentStudentSubmitted],
    ["an expired session", 401, ERROR_MESSAGES.unauthorized],
  ])("throws the server's Hebrew message for %s", async (_label, status, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: message }, status));

    const error = await caught(assignmentClientService.updateAssignment(assignmentId, dto));

    expect(error).toMatchObject({ status, message });
  });

  it("throws the network message when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(assignmentClientService.updateAssignment(assignmentId, dto));

    expect(error).toMatchObject({ status: 0, message: ERROR_MESSAGES.network });
  });
});

describe("assignmentClientService.createAssignment", () => {
  it("posts the assignment as JSON to /api/assignments, with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ assignment: { id: "a1" } }, 201));

    await assignmentClientService.createAssignment(dto);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/assignments");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  });

  it("returns the created assignment from the response", async () => {
    const assignment = { id: "a1", title: dto.title, dueDate: dto.dueDate, description: dto.description, students: [] };
    fetchMock.mockResolvedValue(jsonResponse({ assignment }, 201));

    expect(await assignmentClientService.createAssignment(dto)).toEqual({ assignment });
  });

  it("throws the field errors of a validation error", async () => {
    const fields = { title: ["שם המטלה חייב להכיל לפחות 2 תווים"], studentIds: ["יש לבחור לפחות תלמיד אחד"] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(assignmentClientService.createAssignment(dto));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields });
  });

  it.each([
    ["a student that is not found", 404, ERROR_MESSAGES.studentNotFound],
    ["an expired session", 401, ERROR_MESSAGES.unauthorized],
    ["a server error", 500, ERROR_MESSAGES.internal],
  ])("throws the server's Hebrew message for %s", async (_label, status, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: message }, status));

    const error = await caught(assignmentClientService.createAssignment(dto));

    expect(error).toMatchObject({ status, message });
  });

  it("throws the network message when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(assignmentClientService.createAssignment(dto));

    expect(error).toMatchObject({ status: 0, message: ERROR_MESSAGES.network });
  });
});
