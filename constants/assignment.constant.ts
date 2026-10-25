import type {
  TAssignmentFormValues,
  TAssignmentStatus,
  TStudentAssignment,
} from "@/types/assignment.type";

export const ASSIGNMENT_STATUS_LABELS: Record<TAssignmentStatus, string> = {
  TODO: "לביצוע",
  SUBMITTED: "הוגשה",
};

// What the file picker offers. The server checks the real type of the file again.
export const FILE_ACCEPT = ".pdf,image/jpeg,image/png,image/webp";

export const getAssignmentEditPage = (assignmentId: string): string =>
  `/dashboard/assignments/${assignmentId}/edit`;

export const NEW_ASSIGNMENT_PAGE = "/dashboard/assignments/new";

const SAMPLE_FILE = { name: "עבודה-סרוקה.svg", kind: "image", url: "/sample-submission.svg" } as const;

// Hardcoded until the assignments API exists: the list on every student's page.
export const SAMPLE_STUDENT_ASSIGNMENTS: TStudentAssignment[] = [
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a01",
    title: "עבודה על המהפכה התעשייתית",
    dueDate: "2026-12-15",
    status: "SUBMITTED",
    submittedAt: "2026-12-10",
    grade: 92,
    description:
      "<h2>הנחיות</h2><p>יש לכתוב <strong>עבודה</strong> בת עמוד אחד על <em>המהפכה התעשייתית</em>.</p><ul><li>לציין שלוש סיבות להתחלתה</li><li>להסביר את השפעתה על החברה</li></ul>",
    file: SAMPLE_FILE,
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a02",
    title: "חיבור: המסע שלי",
    dueDate: "2026-11-20",
    status: "SUBMITTED",
    submittedAt: "2026-11-22",
    grade: 85,
    description: "<p>חיבור אישי על <strong>מסע</strong> שעברתם, באורך של עד 250 מילים.</p>",
    file: SAMPLE_FILE,
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a03",
    title: "סיכום הספר",
    dueDate: "2026-10-30",
    status: "SUBMITTED",
    submittedAt: "2026-10-29",
    grade: null,
    description: "<p>סיכום של הספר שנקרא בכיתה, כולל <em>הדמות המרכזית</em> והמסר של הסופר.</p>",
    file: SAMPLE_FILE,
  },
  {
    id: "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5a04",
    title: "תרגילי חשבון - פרק 4",
    dueDate: "2027-01-10",
    status: "TODO",
    submittedAt: null,
    grade: null,
    description: "<ol><li>תרגילים 1 עד 10 בעמוד 52</li><li>תרגיל אתגר בעמוד 55</li></ol>",
    file: null,
  },
];

// Hardcoded until the assignments API exists: what the edit page shows for any assignment.
export const getSampleAssignment = (studentId: string): TAssignmentFormValues => ({
  title: "עבודה על המהפכה התעשייתית",
  studentId,
  dueDate: "2026-12-15",
  description:
    "<h2>הנחיות</h2><p>יש לכתוב <strong>עבודה</strong> בת עמוד אחד על <em>המהפכה התעשייתית</em>.</p><ul><li>לציין שלוש סיבות להתחלתה</li><li>להסביר את השפעתה על החברה</li></ul>",
});
