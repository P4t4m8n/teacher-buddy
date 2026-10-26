import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import ApiError from "./ApiError.client";
import { submissionClientService } from "./submission.client.service";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );

const ASSIGNMENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f90";
const STUDENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
const PART_URL = `/api/assignments/${ASSIGNMENT_ID}/students/${STUDENT_ID}`;

afterEach(() => {
  fetchMock.mockReset();
});

describe("submissionClientService.uploadFile", () => {
  const file = new File(["%PDF-1.7 content"], "עבודה.pdf", { type: "application/pdf" });

  it("puts the file as a form to the file endpoint of this student, with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student: { studentId: STUDENT_ID } }, 200));

    await submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PART_URL}/file`);
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("file")).toBe(file);
  });

  it("does not set the content type itself, so the browser can add the boundary of the form", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student: {} }, 200));

    await submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file);

    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
  });

  it("sends only the file, nothing else", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student: {} }, 200));

    await submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file);

    expect([...(fetchMock.mock.calls[0][1].body as FormData).keys()]).toEqual(["file"]);
  });

  it("returns the part from the response", async () => {
    const student = { studentId: STUDENT_ID, status: "SUBMITTED", grade: null };
    fetchMock.mockResolvedValue(jsonResponse({ student }, 200));

    expect(await submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file)).toEqual({ student });
  });

  it("throws the field error of a file that is refused", async () => {
    const fields = { file: [ERROR_MESSAGES.unsupportedFile] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields });
  });

  it.each([
    ["a file that is far too big", 413, ERROR_MESSAGES.fileTooLarge],
    ["a part that is not found", 404, ERROR_MESSAGES.assignmentNotFound],
    ["an expired session", 401, ERROR_MESSAGES.unauthorized],
  ])("throws the server's Hebrew message for %s", async (_label, status, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: message }, status));

    const error = await caught(submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file));

    expect(error).toMatchObject({ status, message });
  });

  it("throws the network message when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(submissionClientService.uploadFile(ASSIGNMENT_ID, STUDENT_ID, file));

    expect(error).toMatchObject({ status: 0, message: ERROR_MESSAGES.network });
  });
});

describe("submissionClientService.saveGrade", () => {
  it.each([0, 55, 100])("puts the grade %i as JSON to the grade endpoint of this student", async (grade) => {
    fetchMock.mockResolvedValue(jsonResponse({ student: { grade } }, 200));

    await submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, grade);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PART_URL}/grade`);
    expect(options).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade }),
    });
  });

  it("puts null to clear the grade, which is not the same as 0", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student: { grade: null } }, 200));

    await submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, null);

    expect(fetchMock.mock.calls[0][1].body).toBe('{"grade":null}');
  });

  it("returns the part from the response", async () => {
    const student = { studentId: STUDENT_ID, status: "CHECKED", grade: 90 };
    fetchMock.mockResolvedValue(jsonResponse({ student }, 200));

    expect(await submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, 90)).toEqual({ student });
  });

  it("throws the field error of a grade that is refused", async () => {
    const fields = { grade: ["הציון חייב להיות מספר שלם בין 0 ל-100"] };
    fetchMock.mockResolvedValue(jsonResponse({ error: ERROR_MESSAGES.validation, fields }, 400));

    const error = await caught(submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, 150));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields });
  });

  it.each([
    ["a student with no file", 409, ERROR_MESSAGES.gradeNeedsFile],
    ["a part that is not found", 404, ERROR_MESSAGES.assignmentNotFound],
    ["an expired session", 401, ERROR_MESSAGES.unauthorized],
  ])("throws the server's Hebrew message for %s", async (_label, status, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: message }, status));

    const error = await caught(submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, 90));

    expect(error).toMatchObject({ status, message });
  });

  it("throws the network message when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await caught(submissionClientService.saveGrade(ASSIGNMENT_ID, STUDENT_ID, 90));

    expect(error).toMatchObject({ status: 0, message: ERROR_MESSAGES.network });
  });
});
