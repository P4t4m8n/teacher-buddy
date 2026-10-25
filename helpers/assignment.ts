import type {
  TAssignmentFormValues,
  TAssignmentStatus,
  TAssignmentStudent,
  TStudentAssignment,
  TTeacherAssignment,
} from "@/types/assignment.type";

// The status follows from the file and the grade, and is never chosen by hand:
// no file is TODO, a file with no grade is SUBMITTED (it happens when the file is uploaded), and a grade
// makes it CHECKED. A grade is only possible with a file, so a grade without one is not a state.
export const deriveStatus = (hasFile: boolean, grade: number | null): TAssignmentStatus => {
  if (!hasFile) return "TODO";
  return grade === null ? "SUBMITTED" : "CHECKED";
};

// Whether a grade can be given: only after the assignment was submitted, which is when a file exists.
export const canGrade = (hasFile: boolean): boolean => hasFile;

// Students whose assignment was uploaded, whether it was checked afterwards or not.
export const countSubmitted = (assignment: TTeacherAssignment): number =>
  assignment.students.filter(({ status }: TAssignmentStudent) => status !== "TODO").length;

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
