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

// One student's part of a seeded assignment.
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

// A third teacher whose data the write tests (create student, later edit and delete) change freely, so the read-only tests that count rows for the other teachers keep passing.
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

// More data for the demo teacher, so the lists of the demo have more than one page: with DEMO_SEED she has 45 students and 45 assignments (3 pages of 20, 20 and 5).
export type TSeedExtra = {
  classes: TSeedClass[];
  assignments: TSeedAssignment[];
};

const EXTRA_FIRST_NAMES: string[] = ["אדם", "בר", "גל", "דור", "הילה", "ורד", "זיו", "חן", "טל", "יעל", "כרמל", "לימור"];
const EXTRA_LAST_NAMES: string[] = ["אביטל", "בראון", "גבאי", "דוידי", "הרשקוביץ", "וינברג", "זכאי", "חדד", "טולדנו", "יוסף", "כץ", "לביא"];
const EXTRA_CLASS_SIZES: { name: string; size: number }[] = [
  { name: "ח'1", size: 5 },
  { name: "ח'2", size: 5 },
  { name: "ט'1", size: 5 },
  { name: "ח'3", size: 10 },
  { name: "ט'2", size: 10 },
];
const EXTRA_SUBJECTS: string[] = ["חשבון", "עברית", "אנגלית", "מדעים", "היסטוריה", "גאוגרפיה", "תנ\"ך", "ספרות"];
const EXTRA_KINDS: string[] = ["תרגיל", "חיבור", "סיכום", "פרויקט", "עבודה"];
const EXTRA_ASSIGNMENT_COUNT = 41;

// The same first name is never paired with the same last name twice: the last name moves one step for every
// round of the first names, so the 35 names are all different.
const extraName = (index: number): string =>
  `${EXTRA_FIRST_NAMES[index % 12]} ${EXTRA_LAST_NAMES[(index * 5 + Math.floor(index / 12)) % 12]}`;

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const extraStudents = (): TSeedStudent[] => Array.from({ length: 35 }, (_, index) => ({ name: extraName(index), phone: `050-30${String(index + 1).padStart(5, "0")}` }));

const extraClasses = (): TSeedClass[] => {
  const students: TSeedStudent[] = extraStudents();
  let next = 0;
  return EXTRA_CLASS_SIZES.map(({ name, size }) => {
    const inClass: TSeedStudent[] = students.slice(next, next + size);
    next += size;
    return { name, students: inClass };
  });
};

// Assignment number n is given to 2 to 6 students, starting at a different place of the list of all the students, and
// its parts go through every state: not submitted, submitted, and checked with a grade (some of them late).
const extraAssignments = (allStudents: string[]): TSeedAssignment[] =>
  Array.from({ length: EXTRA_ASSIGNMENT_COUNT }, (_, index): TSeedAssignment => {
    const dueDate: string = addDays("2026-09-01", index * 4);
    const partCount: number = 2 + (index % 5);
    return {
      title: `${EXTRA_KINDS[index % 5]} - ${EXTRA_SUBJECTS[index % 8]} (${index + 1})`,
      description: `<p>${EXTRA_KINDS[index % 5]} ב${EXTRA_SUBJECTS[index % 8]}: יש להגיש עד התאריך שנקבע.</p>`,
      dueDate,
      parts: Array.from({ length: partCount }, (_, offset): TSeedAssignmentPart => {
        const student: string = allStudents[(index * 7 + offset) % allStudents.length];
        const state: number = (index + offset) % 4;
        if (state === 0) return { student };
        const submittedAt: string = addDays(dueDate, ((index + offset) % 5) - 3);
        if (state === 1 || state === 3) return { student, submittedAt };
        return { student, submittedAt, grade: 60 + ((index * 13 + offset * 7) % 41) };
      }),
    };
  });

const coreStudentNames: string[] = DEMO_SEED.classes.flatMap(({ students }) => students.map(({ name }) => name));

export const DEMO_EXTRA: TSeedExtra = {
  classes: extraClasses(),
  assignments: extraAssignments([...coreStudentNames, ...extraStudents().map(({ name }) => name)]),
};
