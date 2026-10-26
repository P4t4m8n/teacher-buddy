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

// One student's part of a seeded assignment. The status follows from the date and the grade (deriveStatus),
// and a part with a date also gets a small sample file, so the data never breaks the rule that a submitted
// part has a file. The student is found by name, so it must be one of the teacher's students.
export type TSeedAssignmentPart = {
  student: string;
  // yyyy-mm-dd of the upload. Missing means the student did not submit (TODO).
  submittedAt?: string;
  // Only with submittedAt: a grade needs an uploaded file.
  grade?: number;
};

export type TSeedAssignment = {
  title: string;
  // HTML, as the rich text editor makes it.
  description: string;
  // yyyy-mm-dd
  dueDate: string;
  parts: TSeedAssignmentPart[];
};

export type TSeedTeacher = {
  name: string;
  idNumber: string;
  classes: TSeedClass[];
  assignments?: TSeedAssignment[];
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
  // Every status is here: TODO, SUBMITTED (no grade) and CHECKED (a grade). One submit is after the due date.
  assignments: [
    {
      title: "עבודה על המהפכה התעשייתית",
      dueDate: "2026-12-15",
      description:
        "<h2>הנחיות</h2><p>יש לכתוב <strong>עבודה</strong> בת עמוד אחד על <em>המהפכה התעשייתית</em>.</p><ul><li>לציין שלוש סיבות להתחלתה</li><li>להסביר את השפעתה על החברה</li></ul>",
      parts: [
        { student: "נועה לוי", submittedAt: "2026-12-10", grade: 92 },
        { student: "איתי ברק", submittedAt: "2026-12-12", grade: 88 },
        { student: "מאיה אברהם" },
      ],
    },
    {
      title: "חיבור: המסע שלי",
      dueDate: "2026-11-20",
      description: "<p>חיבור אישי על <strong>מסע</strong> שעברתם, באורך של עד 250 מילים.</p>",
      parts: [
        { student: "נועה לוי", submittedAt: "2026-11-22", grade: 85 },
        { student: "יובל כהן", submittedAt: "2026-11-19", grade: 95 },
      ],
    },
    {
      title: "סיכום הספר",
      dueDate: "2026-10-30",
      description: "<p>סיכום של הספר שנקרא בכיתה, כולל <em>הדמות המרכזית</em> והמסר של הסופר.</p>",
      parts: [{ student: "נועה לוי", submittedAt: "2026-10-29" }, { student: "תמר שפירא" }],
    },
    {
      title: "תרגילי חשבון - פרק 4",
      dueDate: "2027-01-10",
      description: "<ol><li>תרגילים 1 עד 10 בעמוד 52</li><li>תרגיל אתגר בעמוד 55</li></ol>",
      parts: [
        { student: "נועה לוי" },
        { student: "איתי ברק" },
        { student: "מאיה אברהם" },
        { student: "יובל כהן" },
        { student: "תמר שפירא" },
      ],
    },
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
  // One assignment, so tests can check that a teacher only sees their own.
  assignments: [
    {
      title: "קריאה: פרק ראשון",
      dueDate: "2026-11-05",
      description: "<p>יש לקרוא את הפרק הראשון ולכתוב <strong>שלוש שאלות</strong>.</p>",
      parts: [{ student: "דוד גולן", submittedAt: "2026-11-04" }, { student: "הדס רוזן" }],
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
