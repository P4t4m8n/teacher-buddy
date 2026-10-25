import type {
  TAssignmentFile,
  TAssignmentStatus,
  TAssignmentStudent,
  TStudentAssignment,
  TTeacherAssignment,
} from "@/types/assignment.type";
import type { TStudent } from "@/types/student.type";

export const ASSIGNMENT_STATUS_LABELS: Record<TAssignmentStatus, string> = {
  TODO: "לביצוע",
  SUBMITTED: "הוגשה",
};

// What the file picker offers. The server checks the real type of the file again.
export const FILE_ACCEPT = ".pdf,image/jpeg,image/png,image/webp";

// The grade is a whole number in this range, or empty while the assignment was not checked yet.
// The server checks it again.
export const MIN_GRADE = 0;
export const MAX_GRADE = 100;

export const ASSIGNMENTS_PAGE = "/dashboard/assignments";
export const NEW_ASSIGNMENT_PAGE = "/dashboard/assignments/new";

export const getAssignmentPage = (assignmentId: string): string => `${ASSIGNMENTS_PAGE}/${assignmentId}`;

export const getAssignmentEditPage = (assignmentId: string): string => `${getAssignmentPage(assignmentId)}/edit`;

// ----- Hardcoded sample data, until the assignments API exists -----

const SAMPLE_FILE: TAssignmentFile = { name: "עבודה-סרוקה.svg", kind: "image", url: "/sample-submission.svg" };

type TSampleAssignment = Pick<TTeacherAssignment, "id" | "title" | "dueDate" | "description">;

const SAMPLE_ASSIGNMENTS: TSampleAssignment[] = [
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a01",
    title: "עבודה על המהפכה התעשייתית",
    dueDate: "2026-12-15",
    description:
      "<h2>הנחיות</h2><p>יש לכתוב <strong>עבודה</strong> בת עמוד אחד על <em>המהפכה התעשייתית</em>.</p><ul><li>לציין שלוש סיבות להתחלתה</li><li>להסביר את השפעתה על החברה</li></ul>",
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a02",
    title: "חיבור: המסע שלי",
    dueDate: "2026-11-20",
    description: "<p>חיבור אישי על <strong>מסע</strong> שעברתם, באורך של עד 250 מילים.</p>",
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a03",
    title: "סיכום הספר",
    dueDate: "2026-10-30",
    description: "<p>סיכום של הספר שנקרא בכיתה, כולל <em>הדמות המרכזית</em> והמסר של הסופר.</p>",
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a04",
    title: "תרגילי חשבון - פרק 4",
    dueDate: "2027-01-10",
    description: "<ol><li>תרגילים 1 עד 10 בעמוד 52</li><li>תרגיל אתגר בעמוד 55</li></ol>",
  },
];

// A student's part of a sample assignment. "student" is a place in the teacher's student list, so the
// sample uses real students and its links work.
type TSampleEntry = {
  student: number;
  status: TAssignmentStatus;
  submittedAt?: string;
  grade?: number;
};

// One list per assignment in SAMPLE_ASSIGNMENTS. The first student has all of the first four.
const SAMPLE_ENTRIES: TSampleEntry[][] = [
  [
    { student: 0, status: "SUBMITTED", submittedAt: "2026-12-10", grade: 92 },
    { student: 1, status: "SUBMITTED", submittedAt: "2026-12-12", grade: 88 },
    { student: 2, status: "TODO" },
  ],
  [
    { student: 0, status: "SUBMITTED", submittedAt: "2026-11-22", grade: 85 },
    { student: 3, status: "SUBMITTED", submittedAt: "2026-11-19", grade: 95 },
  ],
  [
    { student: 0, status: "SUBMITTED", submittedAt: "2026-10-29" },
    { student: 4, status: "TODO" },
  ],
  [
    { student: 0, status: "TODO" },
    { student: 1, status: "TODO" },
    { student: 2, status: "TODO" },
    { student: 3, status: "TODO" },
    { student: 4, status: "TODO" },
  ],
];

const toSampleStudent = (student: TStudent, entry: TSampleEntry): TAssignmentStudent => ({
  studentId: student.id,
  name: student.name,
  className: student.class.name,
  status: entry.status,
  submittedAt: entry.submittedAt ?? null,
  grade: entry.grade ?? null,
  file: entry.status === "SUBMITTED" ? SAMPLE_FILE : null,
});

// The teacher's assignments, given to the first students of the teacher's list.
export const getSampleTeacherAssignments = (students: TStudent[]): TTeacherAssignment[] =>
  SAMPLE_ASSIGNMENTS.map((assignment: TSampleAssignment, index: number) => ({
    ...assignment,
    students: SAMPLE_ENTRIES[index].flatMap((entry: TSampleEntry) => {
      const student: TStudent | undefined = students[entry.student];
      return student ? [toSampleStudent(student, entry)] : [];
    }),
  }));

// The list on a student's page: every student shows what the first student has.
export const SAMPLE_STUDENT_ASSIGNMENTS: TStudentAssignment[] = SAMPLE_ASSIGNMENTS.flatMap(
  (assignment: TSampleAssignment, index: number) => {
    const entry: TSampleEntry | undefined = SAMPLE_ENTRIES[index].find(({ student }) => student === 0);
    if (!entry) return [];

    return [
      {
        ...assignment,
        status: entry.status,
        submittedAt: entry.submittedAt ?? null,
        grade: entry.grade ?? null,
        file: entry.status === "SUBMITTED" ? SAMPLE_FILE : null,
      },
    ];
  },
);
