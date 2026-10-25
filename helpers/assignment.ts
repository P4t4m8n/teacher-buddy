import type {
  TAssignmentFormValues,
  TAssignmentStudent,
  TStudentAssignment,
  TTeacherAssignment,
} from "@/types/assignment.type";

export const countSubmitted = (assignment: TTeacherAssignment): number =>
  assignment.students.filter(({ status }: TAssignmentStudent) => status === "SUBMITTED").length;

// One student's part of an assignment, in the shape of the modal that shows an assignment. The title also
// has the student's name, because the modal is opened from a list of students.
export const toStudentAssignment = (
  assignment: TTeacherAssignment,
  student: TAssignmentStudent,
): TStudentAssignment => ({
  id: assignment.id,
  title: `${student.name} - ${assignment.title}`,
  dueDate: assignment.dueDate,
  status: student.status,
  submittedAt: student.submittedAt,
  grade: student.grade,
  description: assignment.description,
  file: student.file,
});

// What the add and edit form starts with, for an assignment that already exists.
export const toFormValues = (assignment: TTeacherAssignment): TAssignmentFormValues => ({
  title: assignment.title,
  studentIds: assignment.students.map(({ studentId }: TAssignmentStudent) => studentId),
  dueDate: assignment.dueDate,
  description: assignment.description,
});
