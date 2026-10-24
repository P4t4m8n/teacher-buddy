import type { TStudentAction } from "@/types/student.type";

export const NEW_STUDENT_PAGE = "/dashboard/students/new";

// The links of a student row. Delete is not here: it is a button, not a link.
export const getStudentActions = (studentId: string): TStudentAction[] => [
  {
    key: "details",
    label: "פרטים",
    href: `/dashboard/students/${studentId}`,
  },
  {
    key: "edit",
    label: "עריכה",
    href: `/dashboard/students/${studentId}/edit`,
  },
];
