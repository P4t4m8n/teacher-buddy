import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Client } from "pg";
import { randomLetters, withTestDb } from "./helpers";

// These tests talk to the test database directly, to check the rules that the migration puts in the tables: the status follows the file and the grade, a grade needs a submission, and deleting rows cascades.

type TFixture = {
  teacherId: string;
  classId: string;
  studentId: string;
  otherStudentId: string;
  assignmentId: string;
};

type TStatus = "TODO" | "SUBMITTED" | "CHECKED";

const createFixture = async (client: Client): Promise<TFixture> => {
  const teacher = await client.query(
    `insert into "Teacher" (id, name, "passwordHash") values (gen_random_uuid(), $1, 'x') returning id`,
    [`schema-${randomLetters(12)}`],
  );
  const teacherId: string = teacher.rows[0].id;
  const classRow = await client.query(
    `insert into "Class" (id, name, "teacherId") values (gen_random_uuid(), 'כיתה', $1::uuid) returning id`,
    [teacherId],
  );
  const classId: string = classRow.rows[0].id;
  const insertStudent = async (name: string): Promise<string> =>
    (
      await client.query(
        `insert into "Student" (id, name, phone, "teacherId", "classId")
         values (gen_random_uuid(), $1, '050-0000000', $2::uuid, $3::uuid) returning id`,
        [name, teacherId, classId],
      )
    ).rows[0].id;
  const assignment = await client.query(
    `insert into "Assignment" (id, title, description, "dueDate", "teacherId")
     values (gen_random_uuid(), 'מטלה', '<p>x</p>', '2026-12-15', $1::uuid) returning id`,
    [teacherId],
  );

  return {
    teacherId,
    classId,
    studentId: await insertStudent("תלמיד א"),
    otherStudentId: await insertStudent("תלמיד ב"),
    assignmentId: assignment.rows[0].id,
  };
};

// Students and classes go first: a class cannot be deleted while it has students.
const removeFixture = async (client: Client, { teacherId }: TFixture): Promise<void> => {
  await client.query(`delete from "Student" where "teacherId" = $1::uuid`, [teacherId]);
  await client.query(`delete from "Class" where "teacherId" = $1::uuid`, [teacherId]);
  await client.query(`delete from "Teacher" where id = $1::uuid`, [teacherId]);
};

const withFixture = (run: (client: Client, fixture: TFixture) => Promise<void>): Promise<void> =>
  withTestDb(async (client) => {
    const fixture: TFixture = await createFixture(client);
    try {
      await run(client, fixture);
    } finally {
      await removeFixture(client, fixture);
    }
  });

// A third student for the same teacher, for tests that need three parts.
const createExtraStudent = async (client: Client, likeStudentId: string): Promise<string> =>
  (
    await client.query(
      `insert into "Student" (id, name, phone, "teacherId", "classId")
       select gen_random_uuid(), 'תלמיד ג', '050-0000000', "teacherId", "classId" from "Student" where id = $1::uuid
       returning id`,
      [likeStudentId],
    )
  ).rows[0].id;

const NOW = "2026-10-25 12:00:00";

const insertPart = async (
  client: Client,
  assignmentId: string,
  studentId: string,
  status: TStatus,
  grade: number | null,
  submittedAt: string | null,
): Promise<string> =>
  (
    await client.query(
      `insert into "AssignmentStudent" (id, "assignmentId", "studentId", status, grade, "submittedAt")
       values (gen_random_uuid(), $1::uuid, $2::uuid, $3::"AssignmentStatus", $4::int, $5::timestamp) returning id`,
      [assignmentId, studentId, status, grade, submittedAt],
    )
  ).rows[0].id;

const insertFile = (client: Client, partId: string, data: Buffer = Buffer.from("file")) =>
  client.query(
    `insert into "SubmissionFile" (id, "assignmentStudentId", name, "mimeType", size, data)
     values (gen_random_uuid(), $1::uuid, 'scan.png', 'image/png', $2::int, $3::bytea)`,
    [partId, data.length, data],
  );

const count = async (client: Client, table: string, where: string, id: string): Promise<number> =>
  (await client.query(`select count(*)::int as count from "${table}" where ${where} = $1::uuid`, [id])).rows[0].count;

const STATUS_RULE = /AssignmentStudent_status_matches/;
const GRADE_RULE = /AssignmentStudent_grade_range/;

test.describe("assignment tables: the status follows the file and the grade", () => {
  test("accepts the three valid states", () =>
    withFixture(async (client, { assignmentId, studentId, otherStudentId }) => {
      await insertPart(client, assignmentId, studentId, "TODO", null, null);
      const other = await createExtraStudent(client, studentId);
      await insertPart(client, assignmentId, other, "SUBMITTED", null, NOW);
      await insertPart(client, assignmentId, otherStudentId, "CHECKED", 90, NOW);
    }));

  test("accepts a grade of 0 and a grade of 100", () =>
    withFixture(async (client, { assignmentId, studentId, otherStudentId }) => {
      await insertPart(client, assignmentId, studentId, "CHECKED", 0, NOW);
      await insertPart(client, assignmentId, otherStudentId, "CHECKED", 100, NOW);
    }));

  const INVALID: [string, TStatus, number | null, string | null][] = [
    ["a grade without a submission (CHECKED, no submitted date)", "CHECKED", 90, null],
    ["a grade on a TODO assignment", "TODO", 90, null],
    ["a grade on a TODO assignment that has a submitted date", "TODO", 90, NOW],
    ["a grade on a SUBMITTED assignment", "SUBMITTED", 90, NOW],
    ["CHECKED without a grade", "CHECKED", null, NOW],
    ["TODO with a submitted date", "TODO", null, NOW],
    ["SUBMITTED without a submitted date", "SUBMITTED", null, null],
  ];

  for (const [label, status, grade, submittedAt] of INVALID) {
    test(`rejects ${label}`, () =>
      withFixture(async (client, { assignmentId, studentId }) => {
        await expect(insertPart(client, assignmentId, studentId, status, grade, submittedAt)).rejects.toThrow(
          STATUS_RULE,
        );
        expect(await count(client, "AssignmentStudent", '"studentId"', studentId)).toBe(0);
      }));
  }

  test("rejects a grade below 0 and above 100", () =>
    withFixture(async (client, { assignmentId, studentId, otherStudentId }) => {
      await expect(insertPart(client, assignmentId, studentId, "CHECKED", -1, NOW)).rejects.toThrow(GRADE_RULE);
      await expect(insertPart(client, assignmentId, otherStudentId, "CHECKED", 101, NOW)).rejects.toThrow(GRADE_RULE);
    }));

  test("a SUBMITTED assignment becomes CHECKED when the status, the date and the grade are saved together", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);

      await client.query(`update "AssignmentStudent" set status = 'CHECKED', grade = 85 where id = $1::uuid`, [part]);

      const row = (await client.query(`select status, grade from "AssignmentStudent" where id = $1::uuid`, [part])).rows[0];
      expect(row).toEqual({ status: "CHECKED", grade: 85 });
    }));

  test("a grade cannot be added without the status changing with it", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);

      await expect(client.query(`update "AssignmentStudent" set grade = 85 where id = $1::uuid`, [part])).rejects.toThrow(
        STATUS_RULE,
      );
    }));

  test("a TODO assignment cannot get a grade, even with the status set to CHECKED", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "TODO", null, null);

      await expect(
        client.query(`update "AssignmentStudent" set status = 'CHECKED', grade = 85 where id = $1::uuid`, [part]),
      ).rejects.toThrow(STATUS_RULE);
    }));

  test("a grade can be taken back: CHECKED becomes SUBMITTED", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "CHECKED", 85, NOW);

      await client.query(`update "AssignmentStudent" set status = 'SUBMITTED', grade = null where id = $1::uuid`, [part]);

      const row = (await client.query(`select status, grade from "AssignmentStudent" where id = $1::uuid`, [part])).rows[0];
      expect(row).toEqual({ status: "SUBMITTED", grade: null });
    }));

  test("a new row starts as TODO with no grade and no submitted date", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = (
        await client.query(
          `insert into "AssignmentStudent" (id, "assignmentId", "studentId")
           values (gen_random_uuid(), $1::uuid, $2::uuid) returning status, grade, "submittedAt"`,
          [assignmentId, studentId],
        )
      ).rows[0];

      expect(part).toEqual({ status: "TODO", grade: null, submittedAt: null });
    }));

  test("the status can only be one of the three", () =>
    withTestDb(async (client) => {
      const values = (await client.query(`select unnest(enum_range(null::"AssignmentStatus"))::text as value`)).rows;

      expect(values.map(({ value }) => value)).toEqual(["TODO", "SUBMITTED", "CHECKED"]);
    }));
});

test.describe("assignment tables: who gets an assignment", () => {
  test("a student gets an assignment once", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      await insertPart(client, assignmentId, studentId, "TODO", null, null);

      await expect(insertPart(client, assignmentId, studentId, "TODO", null, null)).rejects.toThrow(
        /AssignmentStudent_assignmentId_studentId_key/,
      );
    }));

  test("a student can have several assignments, and an assignment several students", () =>
    withFixture(async (client, { teacherId, assignmentId, studentId, otherStudentId }) => {
      const second = (
        await client.query(
          `insert into "Assignment" (id, title, description, "dueDate", "teacherId")
           values (gen_random_uuid(), 'מטלה 2', '', '2026-12-20', $1::uuid) returning id`,
          [teacherId],
        )
      ).rows[0].id;

      await insertPart(client, assignmentId, studentId, "TODO", null, null);
      await insertPart(client, assignmentId, otherStudentId, "TODO", null, null);
      await insertPart(client, second, studentId, "TODO", null, null);

      expect(await count(client, "AssignmentStudent", '"assignmentId"', assignmentId)).toBe(2);
      expect(await count(client, "AssignmentStudent", '"studentId"', studentId)).toBe(2);
    }));

  test("an assignment needs a teacher that exists, and a part needs an assignment and a student that exist", () =>
    withFixture(async (client, { assignmentId, studentId, teacherId }) => {
      const missing = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

      await expect(
        client.query(
          `insert into "Assignment" (id, title, description, "dueDate", "teacherId")
           values (gen_random_uuid(), 'x', '', '2026-12-15', $1::uuid)`,
          [missing],
        ),
      ).rejects.toThrow(/Assignment_teacherId_fkey/);
      await expect(insertPart(client, missing, studentId, "TODO", null, null)).rejects.toThrow(
        /AssignmentStudent_assignmentId_fkey/,
      );
      await expect(insertPart(client, assignmentId, missing, "TODO", null, null)).rejects.toThrow(
        /AssignmentStudent_studentId_fkey/,
      );
      expect(teacherId).toBeTruthy();
    }));

  test("the due date is a date, with no time and no shift of the day", () =>
    withFixture(async (client, { assignmentId }) => {
      const column = (
        await client.query(
          `select data_type from information_schema.columns where table_name = 'Assignment' and column_name = 'dueDate'`,
        )
      ).rows[0];
      const day = (await client.query(`select "dueDate"::text as day from "Assignment" where id = $1::uuid`, [assignmentId]))
        .rows[0];

      expect(column.data_type).toBe("date");
      expect(day.day).toBe("2026-12-15");
    }));
});

test.describe("assignment tables: the file", () => {
  test("keeps the bytes exactly, for every byte value", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);
      const bytes = Buffer.from(Array.from({ length: 256 }, (_, index: number) => index));

      await insertFile(client, part, bytes);

      const stored = (await client.query(`select data, size from "SubmissionFile" where "assignmentStudentId" = $1::uuid`, [part])).rows[0];
      expect(Buffer.compare(stored.data, bytes)).toBe(0);
      expect(stored.size).toBe(256);
    }));

  test("keeps a file as big as the upload limit (4 MB)", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);
      const bytes = randomBytes(4 * 1024 * 1024);

      await insertFile(client, part, bytes);

      const stored = (await client.query(`select data from "SubmissionFile" where "assignmentStudentId" = $1::uuid`, [part])).rows[0];
      expect(Buffer.compare(stored.data, bytes)).toBe(0);
    }));

  test("a part has one file at most", () =>
    withFixture(async (client, { assignmentId, studentId }) => {
      const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);
      await insertFile(client, part);

      await expect(insertFile(client, part)).rejects.toThrow(/SubmissionFile_assignmentStudentId_key/);
    }));

  test("a file needs a part that exists", () =>
    withFixture(async (client) => {
      await expect(insertFile(client, "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60")).rejects.toThrow(
        /SubmissionFile_assignmentStudentId_fkey/,
      );
    }));
});

test.describe("assignment tables: deleting cascades", () => {
  const setup = async (client: Client, { assignmentId, studentId, otherStudentId }: TFixture) => {
    const part = await insertPart(client, assignmentId, studentId, "SUBMITTED", null, NOW);
    const otherPart = await insertPart(client, assignmentId, otherStudentId, "SUBMITTED", null, NOW);
    await insertFile(client, part);
    await insertFile(client, otherPart);
    return { part, otherPart };
  };

  test("deleting a student deletes that student's parts and files, and nobody else's, and keeps the assignment", () =>
    withFixture(async (client, fixture) => {
      const { part, otherPart } = await setup(client, fixture);

      await client.query(`delete from "Student" where id = $1::uuid`, [fixture.studentId]);

      expect(await count(client, "AssignmentStudent", "id", part)).toBe(0);
      expect(await count(client, "SubmissionFile", '"assignmentStudentId"', part)).toBe(0);
      expect(await count(client, "AssignmentStudent", "id", otherPart)).toBe(1);
      expect(await count(client, "SubmissionFile", '"assignmentStudentId"', otherPart)).toBe(1);
      expect(await count(client, "Assignment", "id", fixture.assignmentId)).toBe(1);
    }));

  test("deleting an assignment deletes all of its parts and files, and keeps the students", () =>
    withFixture(async (client, fixture) => {
      const { part, otherPart } = await setup(client, fixture);

      await client.query(`delete from "Assignment" where id = $1::uuid`, [fixture.assignmentId]);

      for (const id of [part, otherPart]) {
        expect(await count(client, "AssignmentStudent", "id", id)).toBe(0);
        expect(await count(client, "SubmissionFile", '"assignmentStudentId"', id)).toBe(0);
      }
      expect(await count(client, "Student", "id", fixture.studentId)).toBe(1);
      expect(await count(client, "Student", "id", fixture.otherStudentId)).toBe(1);
    }));

  test("deleting a part deletes its file", () =>
    withFixture(async (client, fixture) => {
      const { part, otherPart } = await setup(client, fixture);

      await client.query(`delete from "AssignmentStudent" where id = $1::uuid`, [part]);

      expect(await count(client, "SubmissionFile", '"assignmentStudentId"', part)).toBe(0);
      expect(await count(client, "SubmissionFile", '"assignmentStudentId"', otherPart)).toBe(1);
    }));

  test("deleting a teacher deletes the teacher's assignments, parts and files", () =>
    withTestDb(async (client) => {
      const fixture = await createFixture(client);
      const { part } = await setup(client, fixture);
      await client.query(`delete from "Student" where "teacherId" = $1::uuid`, [fixture.teacherId]);
      await client.query(`delete from "Class" where "teacherId" = $1::uuid`, [fixture.teacherId]);

      await client.query(`delete from "Teacher" where id = $1::uuid`, [fixture.teacherId]);

      expect(await count(client, "Assignment", "id", fixture.assignmentId)).toBe(0);
      expect(await count(client, "AssignmentStudent", "id", part)).toBe(0);
    }));
});
