// What the assignment form edits. The description is HTML from the rich text editor.
export type TAssignmentFormValues = {
  title: string;
  // The students the assignment is given to.
  studentIds: string[];
  // yyyy-mm-dd, the format of a date input.
  dueDate: string;
  description: string;
};

export type TAssignmentStatus = "TODO" | "SUBMITTED" | "CHECKED";

// How a file is shown: a PDF in a frame, an image as an image, anything else only by its name.
export type TFileKind = "pdf" | "image" | "other";

export type TAssignmentFile = {
  name: string;
  kind: TFileKind;
  url: string;
};

// One row of the student's assignments list, with what the modal shows when it is clicked.
export type TStudentAssignment = {
  id: string;
  title: string;
  // yyyy-mm-dd
  dueDate: string;
  status: TAssignmentStatus;
  // yyyy-mm-dd, empty until the teacher uploads the checked file.
  submittedAt: string | null;
  grade: number | null;
  // HTML from the rich text editor.
  description: string;
  file: TAssignmentFile | null;
};

// One student's part of an assignment: the status, and the checked file once the teacher uploads it.
export type TAssignmentStudent = {
  studentId: string;
  name: string;
  className: string;
  status: TAssignmentStatus;
  // yyyy-mm-dd, empty until the teacher uploads the checked file.
  submittedAt: string | null;
  grade: number | null;
  file: TAssignmentFile | null;
};

// An assignment as the teacher sees it: given to one or more students.
export type TTeacherAssignment = {
  id: string;
  title: string;
  // yyyy-mm-dd
  dueDate: string;
  // HTML from the rich text editor.
  description: string;
  students: TAssignmentStudent[];
};
