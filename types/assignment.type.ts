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
  // The assignment's id.
  id: string;
  // The student the list is of: the modal saves this student's file and grade.
  studentId: string;
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

// A row of the assignments list: only what the list shows, so it does not carry the description or the students.
export type TAssignmentListItem = {
  id: string;
  title: string;
  // yyyy-mm-dd
  dueDate: string;
  studentCount: number;
  // Students whose assignment was uploaded, checked or not.
  submittedCount: number;
};

// A minus in front is descending. "students" is the number of students, "submitted" how many of them uploaded.
export type TAssignmentSort =
  | "title"
  | "-title"
  | "dueDate"
  | "-dueDate"
  | "students"
  | "-students"
  | "submitted"
  | "-submitted";

// What the assignments list is narrowed and ordered by. It is read from the address, so it is always valid.
export type TAssignmentListQuery = {
  // Looked for in the title. Empty: no search.
  search: string;
  sort: TAssignmentSort;
  // 1-based. A page past the end shows the last page.
  page: number;
};

export type TAssignmentList = {
  // The assignments of the page shown.
  assignments: TAssignmentListItem[];
  // All the teacher's assignments, whatever the query.
  total: number;
  // The assignments the query matches, on all the pages: the list shows "N of total".
  matched: number;
  // The page shown: the one asked for, or the last page when it is past the end.
  page: number;
  pageCount: number;
};

// What a request to create an assignment has.
export type TCreateAssignmentDto = {
  title: string;
  // HTML from the rich text editor. The server cleans it before it is saved.
  description: string;
  // yyyy-mm-dd
  dueDate: string;
  studentIds: string[];
};

// An update replaces the title, description, due date and students, so it has the same shape as a create, with one
// more field for the case of a student who already submitted being removed.
export type TUpdateAssignmentDto = TCreateAssignmentDto & {
  // The students who already submitted whom the teacher confirmed removing: their file and grade are deleted with
  // them. A removed student who submitted and is not in this list stops the update (409), so a submission that
  // arrived after the teacher looked at the page is never deleted by a confirmation that did not mention it.
  confirmedRemovalIds?: string[];
};

// A student's part that was already submitted, as the edit form needs it to ask before the student is removed.
export type TSubmittedPart = {
  studentId: string;
  name: string;
  // The file is deleted with the part, and so is the grade, if there is one.
  grade: number | null;
};

export type TGetAssignmentsResponse = {
  assignments: TAssignmentListItem[];
};

export type TGetAssignmentResponse = {
  assignment: TTeacherAssignment;
};

export type TCreateAssignmentResponse = {
  assignment: TTeacherAssignment;
};

export type TUpdateAssignmentResponse = {
  assignment: TTeacherAssignment;
};

export type TDeleteAssignmentResponse = {
  id: string;
};

export type TUploadSubmissionResponse = {
  student: TAssignmentStudent;
};

// The grade of one student's part: a whole number from 0 to 100, or null to clear it.
export type TUpdateGradeDto = {
  grade: number | null;
};

export type TUpdateGradeResponse = {
  student: TAssignmentStudent;
};
