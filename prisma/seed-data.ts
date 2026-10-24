import { DEMO_TEACHER } from "../constants/demo.constant";

// Plain data, no database imports: shared by the seed script and the e2e tests.

export type TSeedStudent = {
  name: string;
  phone: string;
};

export type TSeedClass = {
  name: string;
  students: TSeedStudent[];
};

export type TSeedTeacher = {
  name: string;
  idNumber: string;
  classes: TSeedClass[];
};

export const DEMO_SEED: TSeedTeacher = {
  ...DEMO_TEACHER,
  classes: [
    {
      name: "ח'1",
      students: [
        { name: "נועה לוי", phone: "050-1234567" },
        { name: "איתי ברק", phone: "052-7654321" },
        { name: "מאיה אברהם", phone: "054-1112233" },
      ],
    },
    {
      name: "ח'2",
      students: [
        { name: "יובל כהן", phone: "050-2223344" },
        { name: "תמר שפירא", phone: "052-3334455" },
        { name: "אורי מזרחי", phone: "053-4445566" },
      ],
    },
    {
      name: "ט'1",
      students: [
        { name: "שיר דהן", phone: "054-5556677" },
        { name: "אמיר פרץ", phone: "050-6667788" },
        { name: "ליאור בן דוד", phone: "052-7778899" },
        { name: "רוני אזולאי", phone: "058-8889900" },
      ],
    },
    // A class with no students, so deleting a class can be tested later.
    { name: "י'1", students: [] },
  ],
};

// A second teacher, so tests can verify a teacher never sees another teacher's data.
export const OTHER_SEED: TSeedTeacher = {
  name: "יוסי מזרחי",
  idNumber: "111222333",
  classes: [
    {
      name: "ז'1",
      students: [
        { name: "דוד גולן", phone: "050-9998877" },
        { name: "הדס רוזן", phone: "052-1119988" },
      ],
    },
  ],
};

// A third teacher whose data the write tests (create student, later edit and delete) change freely,
// so the read-only tests that count rows for the other teachers keep passing. Each class has one
// student so the tests can find the class ids through GET /api/students.
export const WRITE_SEED: TSeedTeacher = {
  name: "נעמה שרון",
  idNumber: "444555666",
  classes: [
    { name: "א'1", students: [{ name: "אלון בדיקה", phone: "050-0000001" }] },
    { name: "א'2", students: [{ name: "אורית בדיקה", phone: "050-0000002" }] },
  ],
};

// A second teacher the write tests can change freely, for tests that need two teachers to create data.
export const WRITE_OTHER_SEED: TSeedTeacher = {
  name: "רונית אביב",
  idNumber: "777888999",
  classes: [{ name: "ב'1", students: [{ name: "ברק בדיקה", phone: "050-0000003" }] }],
};

export const SEED_TEACHERS: TSeedTeacher[] = [DEMO_SEED, OTHER_SEED, WRITE_SEED, WRITE_OTHER_SEED];
