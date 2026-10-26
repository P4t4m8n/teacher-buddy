import type { TAssignmentSort, TAssignmentStatus } from "@/types/assignment.type";

export const DEFAULT_ASSIGNMENT_SORT: TAssignmentSort = "-dueDate";

export const ASSIGNMENT_SORT_OPTIONS: { value: TAssignmentSort; label: string }[] = [
  { value: "-dueDate", label: "תאריך הגשה (החדש ראשון)" },
  { value: "dueDate", label: "תאריך הגשה (הישן ראשון)" },
  { value: "title", label: "שם (א-ת)" },
  { value: "-title", label: "שם (ת-א)" },
  { value: "-students", label: "מספר תלמידים (מהרב למעט)" },
  { value: "students", label: "מספר תלמידים (מהמעט לרב)" },
  { value: "-submitted", label: "הוגשו (מהרב למעט)" },
  { value: "submitted", label: "הוגשו (מהמעט לרב)" },
];

export const ASSIGNMENT_STATUS_LABELS: Record<TAssignmentStatus, string> = {
  TODO: "לביצוע",
  SUBMITTED: "הוגשה",
  CHECKED: "נבדקה",
};

// What the file picker offers. The server checks the real type of the file again.
export const FILE_ACCEPT = ".pdf,image/jpeg,image/png,image/webp";

// The most a teacher can upload for one student, 4 MB: a request over 4.5 MB is refused by Vercel, so this
// leaves room for the rest of the request. The server checks it again.
export const MAX_FILE_SIZE = 4 * 1024 * 1024;

// The grade is a whole number in this range, or empty while the assignment was not checked yet.
// The server checks it again.
export const MIN_GRADE = 0;
export const MAX_GRADE = 100;

export const ASSIGNMENTS_PAGE = "/dashboard/assignments";
export const NEW_ASSIGNMENT_PAGE = "/dashboard/assignments/new";

export const getAssignmentPage = (assignmentId: string): string => `${ASSIGNMENTS_PAGE}/${assignmentId}`;

export const getAssignmentEditPage = (assignmentId: string): string => `${getAssignmentPage(assignmentId)}/edit`;
