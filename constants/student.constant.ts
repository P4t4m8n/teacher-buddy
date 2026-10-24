import type { TStudentAction } from "@/types/student.type";

// Thrown by the student service and matched by the route handler to pick the status code.
export const CLASS_NOT_FOUND_MESSAGE = "Class not found";
export const STUDENT_EXISTS_MESSAGE = "Student already exists";

// Hardcoded for now: these pages are built in the assignments feature.
export const getStudentActions = (studentId: string): TStudentAction[] => [
  {
    key: "new-assignment",
    label: "מטלה חדשה",
    href: `/students/${studentId}/assignments/new`,
  },
  {
    key: "edit-assignment",
    label: "עריכת מטלה",
    href: `/students/${studentId}/assignments`,
  },
  {
    key: "grade",
    label: "הזנת ציון",
    href: `/students/${studentId}/grade`,
  },
];
