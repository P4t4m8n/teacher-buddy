import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TAssignmentStudent, TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import { getStudentList, signInAs, signToken, submitPart, UNKNOWN_TEACHER_ID, withTestDb } from "./helpers";

const ASSIGNMENTS_URL = "/api/assignments";
const MAX_FILE_SIZE = 4 * 1024 * 1024;

// These tests create assignments in the shared test database, for the write teachers only (the global setup
// removes them before every run), so the read-only tests that count the other teachers' rows are not affected.

const withPadding = (header: number[], size: number): Buffer => {
  const padded: Buffer = Buffer.alloc(size);
  Buffer.from(header).copy(padded);
  return padded;
};

const PDF_HEADER: number[] = [...Buffer.from("%PDF-1.7\n")];
const PNG_HEADER: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER: number[] = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER: number[] = [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBPVP8 ")];

type TUploadFile = { name: string; mimeType: string; buffer: Buffer };

const upload = (
  request: APIRequestContext,
  assignmentId: string,
  studentId: string,
  file: TUploadFile,
  extra: Record<string, string> = {},
): Promise<APIResponse> =>
  request.put(`${ASSIGNMENTS_URL}/${assignmentId}/students/${studentId}/file`, { multipart: { file, ...extra } });

const pdfFile = (name: string = "עבודה.pdf", size: number = 200): TUploadFile => ({
  name,
  mimeType: "application/pdf",
  buffer: withPadding(PDF_HEADER, size),
});

const createAssignment = async (request: APIRequestContext, studentIds: string[]): Promise<TTeacherAssignment> => {
  const response = await request.post(ASSIGNMENTS_URL, {
    data: {
      title: `מטלה ${Math.random().toString(36).slice(2, 8)}`,
      description: "<p>הנחיות</p>",
      dueDate: "2030-06-15",
      studentIds,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).assignment;
};

// The write teacher's two students, and an assignment given to both.
const setup = async (
  request: APIRequestContext,
): Promise<{ students: TStudent[]; assignment: TTeacherAssignment }> => {
  await signInAs(request, WRITE_SEED);
  const students: TStudent[] = await getStudentList(request);
  return { students, assignment: await createAssignment(request, students.map(({ id }) => id)) };
};

const partOf = async (request: APIRequestContext, assignmentId: string, studentId: string): Promise<TAssignmentStudent> => {
  const response = await request.get(`${ASSIGNMENTS_URL}/${assignmentId}`);
  const assignment: TTeacherAssignment = (await response.json()).assignment;
  const part = assignment.students.find((student) => student.studentId === studentId);
  if (!part) throw new Error("The student is not in the assignment");
  return part;
};

type TStoredFile = { count: number; name: string | null; mimeType: string | null; size: number | null; data: Buffer | null };

const readStoredFile = (assignmentId: string, studentId: string): Promise<TStoredFile> =>
  withTestDb(async (client) => {
    const result = await client.query(
      `select f.name, f."mimeType", f.size, f.data
       from "AssignmentStudent" s join "SubmissionFile" f on f."assignmentStudentId" = s.id
       where s."assignmentId" = $1::uuid and s."studentId" = $2::uuid`,
      [assignmentId, studentId],
    );
    const row = result.rows[0];
    return { count: result.rowCount ?? 0, name: row?.name ?? null, mimeType: row?.mimeType ?? null, size: row?.size ?? null, data: row?.data ?? null };
  });

const israelToday = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

test.describe("PUT /api/assignments/[id]/students/[studentId]/file: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await upload(request, UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID, pdfFile());

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("checks the session before the body: 401 even without a file", async ({ request }) => {
    const response = await request.put(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}/students/${UNKNOWN_TEACHER_ID}/file`, {
      multipart: { other: "x" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.put(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}/students/${UNKNOWN_TEACHER_ID}/file`, {
      multipart: { file: pdfFile() },
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const response = await request.put(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}/students/${UNKNOWN_TEACHER_ID}/file`, {
      multipart: { file: pdfFile() },
      headers: { Cookie: `session=${await signToken(UNKNOWN_TEACHER_ID, "1h")}` },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/file: a first upload", () => {
  test("makes the student's part SUBMITTED, with the file as a link and the day of the upload", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const before: string = israelToday();

    const response = await upload(request, assignment.id, students[0].id, pdfFile("עבודה של נועה.pdf"));

    expect(response.status()).toBe(200);
    const { student } = await response.json();
    expect(Object.keys(student).sort()).toEqual(["className", "file", "grade", "name", "status", "studentId", "submittedAt"]);
    expect(student).toMatchObject({
      studentId: students[0].id,
      name: students[0].name,
      className: students[0].class.name,
      status: "SUBMITTED",
      grade: null,
      file: {
        name: "עבודה של נועה.pdf",
        kind: "pdf",
        url: `/api/assignments/${assignment.id}/students/${students[0].id}/file`,
      },
    });
    expect([before, israelToday()]).toContain(student.submittedAt);
    expect(Object.keys(student.file).sort()).toEqual(["kind", "name", "url"]);
  });

  test("is saved: the assignment shows the part as SUBMITTED, and the other student is not touched", async ({ request }) => {
    const { students, assignment } = await setup(request);

    await upload(request, assignment.id, students[0].id, pdfFile());

    expect(await partOf(request, assignment.id, students[0].id)).toMatchObject({ status: "SUBMITTED", file: { kind: "pdf" } });
    expect(await partOf(request, assignment.id, students[1].id)).toMatchObject({
      status: "TODO",
      submittedAt: null,
      grade: null,
      file: null,
    });
    expect((await readStoredFile(assignment.id, students[1].id)).count).toBe(0);
  });

  test("keeps the bytes, the size and the type in the database exactly", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const file: TUploadFile = pdfFile("a.pdf", 5000);
    file.buffer.fill(0xab, 100);

    await upload(request, assignment.id, students[0].id, file);

    const stored: TStoredFile = await readStoredFile(assignment.id, students[0].id);
    expect(stored).toMatchObject({ count: 1, name: "a.pdf", mimeType: "application/pdf", size: 5000 });
    expect(stored.data?.equals(file.buffer)).toBe(true);
  });

  const IMAGES: [string, string, string, number[]][] = [
    ["a PNG", "scan.png", "image/png", PNG_HEADER],
    ["a JPEG", "scan.jpg", "image/jpeg", JPEG_HEADER],
    ["a WebP", "scan.webp", "image/webp", WEBP_HEADER],
  ];

  for (const [label, name, mimeType, header] of IMAGES) {
    test(`accepts ${label}, as an image`, async ({ request }) => {
      const { students, assignment } = await setup(request);

      const response = await upload(request, assignment.id, students[0].id, { name, mimeType, buffer: withPadding(header, 300) });

      expect(response.status()).toBe(200);
      expect((await response.json()).student.file).toMatchObject({ name, kind: "image" });
      expect(await readStoredFile(assignment.id, students[0].id)).toMatchObject({ mimeType });
    });
  }

  test("takes the type from the bytes, not from the name or the type the browser says", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, {
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: withPadding(PNG_HEADER, 300),
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).student.file).toMatchObject({ name: "scan.pdf", kind: "image" });
    expect(await readStoredFile(assignment.id, students[0].id)).toMatchObject({ mimeType: "image/png" });
  });

  test("accepts a file of exactly 4 MB", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, pdfFile("big.pdf", MAX_FILE_SIZE));

    expect(response.status()).toBe(200);
    expect((await readStoredFile(assignment.id, students[0].id)).size).toBe(MAX_FILE_SIZE);
  });

  test("keeps only the name of the file when the browser sends a path", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, pdfFile("C:\\fakepath\\work.pdf"));

    expect(response.status()).toBe(200);
    expect((await response.json()).student.file.name).toBe("work.pdf");
  });

  test("never takes the status, the grade or the date from the form", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, pdfFile(), {
      status: "CHECKED",
      grade: "100",
      submittedAt: "2000-01-01",
      studentId: students[1].id,
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ studentId: students[0].id, status: "SUBMITTED", grade: null });
    expect((await partOf(request, assignment.id, students[1].id)).status).toBe("TODO");
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/file: a new file for a part that has one", () => {
  test("replaces the file, and keeps the status SUBMITTED: there is still one file", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("old.pdf", 100));

    const response = await upload(request, assignment.id, students[0].id, {
      name: "new.png",
      mimeType: "image/png",
      buffer: withPadding(PNG_HEADER, 400),
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ status: "SUBMITTED", file: { name: "new.png", kind: "image" } });
    expect(await readStoredFile(assignment.id, students[0].id)).toMatchObject({
      count: 1,
      name: "new.png",
      mimeType: "image/png",
      size: 400,
    });
  });

  test("keeps CHECKED and the grade of a checked part: the teacher decides about the grade", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 77, mimeType: "application/pdf" });

    const response = await upload(request, assignment.id, students[0].id, pdfFile("fixed.pdf", 300));

    expect(response.status()).toBe(200);
    const { student } = await response.json();
    expect(student).toMatchObject({ status: "CHECKED", grade: 77, file: { name: "fixed.pdf" } });
    expect(student.submittedAt).toBe(israelToday());
    expect(await readStoredFile(assignment.id, students[0].id)).toMatchObject({ count: 1, name: "fixed.pdf", size: 300 });
  });

  test("keeps a grade of 0", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 0, mimeType: "application/pdf" });

    const response = await upload(request, assignment.id, students[0].id, pdfFile());

    expect((await response.json()).student).toMatchObject({ status: "CHECKED", grade: 0 });
  });

  test("two uploads at the same time leave one file, and one of them is the last", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const responses = await Promise.all([
      upload(request, assignment.id, students[0].id, pdfFile("first.pdf", 111)),
      upload(request, assignment.id, students[0].id, pdfFile("second.pdf", 222)),
    ]);

    expect(responses.map((response) => response.status())).toEqual([200, 200]);
    const stored: TStoredFile = await readStoredFile(assignment.id, students[0].id);
    expect(stored.count).toBe(1);
    expect(["first.pdf", "second.pdf"]).toContain(stored.name);
    expect(stored.size).toBe(stored.name === "first.pdf" ? 111 : 222);
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/file: a file that is refused", () => {
  const expectRefused = async (response: APIResponse, status: number, fields: Record<string, string[]>): Promise<void> => {
    expect(response.status()).toBe(status);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.validation, fields });
  };

  const NOT_ALLOWED: [string, string, string, Buffer][] = [
    ["text with a PDF name and type", "work.pdf", "application/pdf", Buffer.from("just some text")],
    ["HTML", "page.pdf", "application/pdf", Buffer.from("<html><script>alert(1)</script></html>")],
    ["an SVG image, which can run scripts", "drawing.png", "image/png", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["a GIF", "anim.png", "image/png", Buffer.from("GIF89a....")],
    ["a Windows program", "run.pdf", "application/pdf", Buffer.from("MZ\x90\x00\x03")],
    ["a Word file", "work.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])],
  ];

  for (const [label, name, mimeType, buffer] of NOT_ALLOWED) {
    test(`returns 400 for ${label}, and saves nothing`, async ({ request }) => {
      const { students, assignment } = await setup(request);

      const response = await upload(request, assignment.id, students[0].id, { name, mimeType, buffer });

      await expectRefused(response, 400, { file: [ERROR_MESSAGES.unsupportedFile] });
      expect((await readStoredFile(assignment.id, students[0].id)).count).toBe(0);
      expect((await partOf(request, assignment.id, students[0].id)).status).toBe("TODO");
    });
  }

  test("returns 400 for an empty file", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) });

    await expectRefused(response, 400, { file: ["הקובץ ריק"] });
  });

  test("returns 400 for a file one byte over 4 MB", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, pdfFile("big.pdf", MAX_FILE_SIZE + 1));

    await expectRefused(response, 400, { file: [ERROR_MESSAGES.fileTooLarge] });
    expect((await readStoredFile(assignment.id, students[0].id)).count).toBe(0);
  });

  test("returns 413 for a request far over the limit, without reading it", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await upload(request, assignment.id, students[0].id, pdfFile("huge.pdf", 6 * 1024 * 1024));

    expect(response.status()).toBe(413);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.fileTooLarge });
    expect((await readStoredFile(assignment.id, students[0].id)).count).toBe(0);
  });

  test("returns 400 when the form has no file, or the file is only text", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const url = `${ASSIGNMENTS_URL}/${assignment.id}/students/${students[0].id}/file`;

    await expectRefused(await request.put(url, { multipart: { other: "x" } }), 400, { file: ["יש לבחור קובץ"] });
    await expectRefused(await request.put(url, { multipart: { file: "work.pdf" } }), 400, { file: ["יש לבחור קובץ"] });
  });

  test("returns 400 when the body is not a form", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await request.put(`${ASSIGNMENTS_URL}/${assignment.id}/students/${students[0].id}/file`, {
      data: Buffer.from("not a form"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.invalidFormData });
  });

  test("a refused file does not change a part that already has a file", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("good.pdf", 150));

    const response = await upload(request, assignment.id, students[0].id, {
      name: "bad.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a pdf"),
    });

    expect(response.status()).toBe(400);
    expect(await readStoredFile(assignment.id, students[0].id)).toMatchObject({ count: 1, name: "good.pdf", size: 150 });
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/file: not found", () => {
  test("returns 404 for an assignment that does not exist", async ({ request }) => {
    const { students } = await setup(request);

    const response = await upload(request, UNKNOWN_TEACHER_ID, students[0].id, pdfFile());

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  });

  test("returns the same 404 for a student of the teacher who is not in the assignment", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const students: TStudent[] = await getStudentList(request);
    const assignment: TTeacherAssignment = await createAssignment(request, [students[0].id]);

    const response = await upload(request, assignment.id, students[1].id, pdfFile());

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    expect((await readStoredFile(assignment.id, students[1].id)).count).toBe(0);
  });

  test("returns the same 404 for an assignment of another teacher, and saves nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await signInAs(request, WRITE_OTHER_SEED);

    const response = await upload(request, assignment.id, students[0].id, pdfFile());

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    expect((await readStoredFile(assignment.id, students[0].id)).count).toBe(0);
  });

  test("returns the same 404 for ids that are not uuids", async ({ request }) => {
    const { students, assignment } = await setup(request);

    for (const [assignmentId, studentId] of [
      ["abc", students[0].id],
      [assignment.id, "abc"],
      ["' OR 1=1 --", "123"],
    ]) {
      const response = await upload(request, assignmentId, studentId, pdfFile());
      expect(response.status(), `${assignmentId} ${studentId}`).toBe(404);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    }
  });
});

const fileUrl = (assignmentId: string, studentId: string): string =>
  `${ASSIGNMENTS_URL}/${assignmentId}/students/${studentId}/file`;

test.describe("GET /api/assignments/[id]/students/[studentId]/file: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get(fileUrl(UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID));

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.get(fileUrl(UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID), {
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const response = await request.get(fileUrl(UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID), {
      headers: { Cookie: `session=${await signToken(UNKNOWN_TEACHER_ID, "1h")}` },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 again after logout, for a file that was readable", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile());
    expect((await request.get(fileUrl(assignment.id, students[0].id))).status()).toBe(200);

    await request.post("/api/auth/logout");

    expect((await request.get(fileUrl(assignment.id, students[0].id))).status()).toBe(401);
  });
});

test.describe("GET /api/assignments/[id]/students/[studentId]/file: the file", () => {
  test("gives the exact bytes that were uploaded, with the headers that show a PDF in the page", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const file: TUploadFile = pdfFile("work.pdf", 6000);
    file.buffer.fill(0xcd, 50);
    await upload(request, assignment.id, students[0].id, file);

    const response = await request.get(fileUrl(assignment.id, students[0].id));

    expect(response.status()).toBe(200);
    expect((await response.body()).equals(file.buffer)).toBe(true);
    expect(response.headers()).toMatchObject({
      "content-type": "application/pdf",
      "content-length": "6000",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    });
    expect(response.headers()["content-disposition"]).toBe(`inline; filename="work.pdf"; filename*=UTF-8''work.pdf`);
  });

  test("gives an image with the type that was found in its bytes", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const buffer: Buffer = withPadding(PNG_HEADER, 500);
    await upload(request, assignment.id, students[0].id, { name: "scan.pdf", mimeType: "application/pdf", buffer });

    const response = await request.get(fileUrl(assignment.id, students[0].id));

    expect(response.headers()["content-type"]).toBe("image/png");
    expect((await response.body()).equals(buffer)).toBe(true);
  });

  test("gives the real name, in Hebrew, in the header", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("עבודה של נועה (סופי).pdf"));

    const disposition: string = (await request.get(fileUrl(assignment.id, students[0].id))).headers()["content-disposition"];

    const encoded = /filename\*=UTF-8''(.+)$/.exec(disposition)?.[1] ?? "";
    expect(decodeURIComponent(encoded)).toBe("עבודה של נועה (סופי).pdf");
    expect(disposition).toMatch(/^inline;/);
  });

  test("is the link that the assignment gives for the file", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const file: TUploadFile = pdfFile("a.pdf", 321);
    await upload(request, assignment.id, students[0].id, file);
    const part: TAssignmentStudent = await partOf(request, assignment.id, students[0].id);

    const response = await request.get(part.file?.url ?? "");

    expect(response.status()).toBe(200);
    expect((await response.body()).equals(file.buffer)).toBe(true);
  });

  test("gives the new file after the file was replaced", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("old.pdf", 100));
    const replacement: Buffer = withPadding(JPEG_HEADER, 250);
    await upload(request, assignment.id, students[0].id, { name: "new.jpg", mimeType: "image/jpeg", buffer: replacement });

    const response = await request.get(fileUrl(assignment.id, students[0].id));

    expect(response.headers()["content-type"]).toBe("image/jpeg");
    expect((await response.body()).equals(replacement)).toBe(true);
  });

  test("gives each student their own file", async ({ request }) => {
    const { students, assignment } = await setup(request);
    const first: TUploadFile = pdfFile("a.pdf", 100);
    const second: TUploadFile = { name: "b.png", mimeType: "image/png", buffer: withPadding(PNG_HEADER, 200) };
    await upload(request, assignment.id, students[0].id, first);
    await upload(request, assignment.id, students[1].id, second);

    expect((await (await request.get(fileUrl(assignment.id, students[0].id))).body()).equals(first.buffer)).toBe(true);
    expect((await (await request.get(fileUrl(assignment.id, students[1].id))).body()).equals(second.buffer)).toBe(true);
  });

  test("never shows a stored type that cannot be uploaded: it is a download of unknown type", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("page.pdf", 100));
    await withTestDb((client) =>
      client.query(
        `update "SubmissionFile" set "mimeType" = 'text/html'
         where "assignmentStudentId" in (select id from "AssignmentStudent" where "assignmentId" = $1::uuid)`,
        [assignment.id],
      ),
    );

    const response = await request.get(fileUrl(assignment.id, students[0].id));

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/octet-stream");
    expect(response.headers()["content-disposition"]).toMatch(/^attachment;/);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("GET /api/assignments/[id]/students/[studentId]/file: not found", () => {
  const expectFileNotFound = async (response: APIResponse): Promise<void> => {
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.fileNotFound });
  };

  test("returns 404 for a student who has not uploaded", async ({ request }) => {
    const { students, assignment } = await setup(request);

    await expectFileNotFound(await request.get(fileUrl(assignment.id, students[0].id)));
  });

  test("returns the same 404 for an assignment that does not exist", async ({ request }) => {
    const { students } = await setup(request);

    await expectFileNotFound(await request.get(fileUrl(UNKNOWN_TEACHER_ID, students[0].id)));
  });

  test("returns the same 404 for a student who is not in the assignment", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const students: TStudent[] = await getStudentList(request);
    const assignment: TTeacherAssignment = await createAssignment(request, [students[0].id]);
    await upload(request, assignment.id, students[0].id, pdfFile());

    await expectFileNotFound(await request.get(fileUrl(assignment.id, students[1].id)));
  });

  test("returns the same 404 for the file of another teacher, and never its bytes", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await upload(request, assignment.id, students[0].id, pdfFile("secret.pdf", 100));
    await signInAs(request, WRITE_OTHER_SEED);

    const response = await request.get(fileUrl(assignment.id, students[0].id));

    await expectFileNotFound(response);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("returns the same 404 for ids that are not uuids", async ({ request }) => {
    const { students, assignment } = await setup(request);

    for (const [assignmentId, studentId] of [
      ["abc", students[0].id],
      [assignment.id, "abc"],
      ["' OR 1=1 --", "123"],
    ]) {
      await expectFileNotFound(await request.get(fileUrl(assignmentId, studentId)));
    }
  });
});
