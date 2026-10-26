import type { TStudentAction, TStudentSort } from "@/types/student.type";

export const STUDENTS_PAGE = "/dashboard";
export const NEW_STUDENT_PAGE = "/dashboard/students/new";

export const DEFAULT_STUDENT_SORT: TStudentSort = "name";

export const STUDENT_SORT_OPTIONS: { value: TStudentSort; label: string }[] = [
  { value: "name", label: "שם (א-ת)" },
  { value: "-name", label: "שם (ת-א)" },
  { value: "class", label: "כיתה (א-ת)" },
  { value: "-class", label: "כיתה (ת-א)" },
  { value: "phone", label: "טלפון (עולה)" },
  { value: "-phone", label: "טלפון (יורד)" },
];

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
