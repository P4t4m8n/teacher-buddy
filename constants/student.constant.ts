import type { TStudentAction } from "@/types/student.type";

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
