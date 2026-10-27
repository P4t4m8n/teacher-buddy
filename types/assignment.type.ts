// What the assignment form edits. The description is HTML from the rich text editor (fancy text, tiny tags).
export type TAssignmentFormValues = {
  title: string;
  // The lucky students who receive the assignment.
  studentIds: string[];
  // yyyy-mm-dd, the format a date input insists on, politely but firmly.
  dueDate: string;
  description: string;
};

export type TAssignmentStatus = "TODO" | "SUBMITTED" | "CHECKED";

// How a file is shown: a PDF in a frame like a painting, an image as an image, anything else only by its name.
export type TFileKind = "pdf" | "image" | "other";

export type TAssignmentFile = {
  name: string;
  kind: TFileKind;
  url: string;
};

// One row of the student's assignments list, plus whatever pops out of the modal when it is clicked.
export type TStudentAssignment = {
  // The assignment's id, its name tag.
  id: string;
  // The student whose list this is: the modal files this student's file and grade in the right drawer.
  studentId: string;
  title: string;
  // yyyy-mm-dd, the deadline's calendar outfit
  dueDate: string;
  status: TAssignmentStatus;
  // yyyy-mm-dd, empty until the teacher uploads the checked file (no file, no date).
  submittedAt: string | null;
  grade: number | null;
  // HTML from the rich text editor, tags and all.
  description: string;
  file: TAssignmentFile | null;
};

// One student's part of the assignment pie: the status, and the checked file once the teacher uploads it.
export type TAssignmentStudent = {
  studentId: string;
  name: string;
  className: string;
  status: TAssignmentStatus;
  // yyyy-mm-dd, empty until the teacher uploads the checked file. Patience.
  submittedAt: string | null;
  grade: number | null;
  file: TAssignmentFile | null;
};

// An assignment as the teacher sees it: handed out to one or more students, like homework confetti.
export type TTeacherAssignment = {
  id: string;
  title: string;
  // yyyy-mm-dd, mark it on the calendar
  dueDate: string;
  // HTML from the rich text editor, straight from the source.
  description: string;
  students: TAssignmentStudent[];
};

// A row of the assignments list: travels light, so no description and no students in its luggage.
export type TAssignmentListItem = {
  id: string;
  title: string;
  // yyyy-mm-dd, as the list likes it
  dueDate: string;
  studentCount: number;
  // Students whose assignment was uploaded, checked or not (the red pen can wait).
  submittedCount: number;
};

// A minus in front is descending (down the slide). "students" is the number of students, "submitted" how many of them uploaded.
export type TAssignmentSort =
  | "title"
  | "-title"
  | "dueDate"
  | "-dueDate"
  | "students"
  | "-students"
  | "submitted"
  | "-submitted";

// What the assignments list is narrowed and ordered by. Read from the address, so it arrives already tidied and valid.
export type TAssignmentListQuery = {
  // Sniffed for in the title. Empty: no sniffing.
  search: string;
  sort: TAssignmentSort;
  // 1-based (nobody starts counting at zero here). A page past the end shows the last page.
  page: number;
};

export type TAssignmentList = {
  // The assignments of the page shown: today's menu.
  assignments: TAssignmentListItem[];
  // All the teacher's assignments, whatever the query, the whole pile.
  total: number;
  // The assignments the query matches, on all the pages: the list shows "N of total", like a scoreboard.
  matched: number;
  // The page shown: the one asked for, or the last page when the request overshoots like a bad dart throw.
  page: number;
  pageCount: number;
};

// What a request to create an assignment brings to the table.
export type TCreateAssignmentDto = {
  title: string;
  // HTML from the rich text editor. The server gives it a good scrub before it is saved.
  description: string;
  // yyyy-mm-dd, the usual
  dueDate: string;
  studentIds: string[];
};

// An update replaces the title, description, due date and students, so it is a create in a trench coat, with one
// more field for the case of a student who already submitted being removed.
export type TUpdateAssignmentDto = TCreateAssignmentDto & {
  // The students who already submitted whom the teacher confirmed removing: their file and grade are deleted with them, so no goodbye note survives.
  confirmedRemovalIds?: string[];
};

// A student's part that was already submitted, as the edit form needs it to ask "really?" before the student is removed.
export type TSubmittedPart = {
  studentId: string;
  name: string;
  // The file is deleted with the part, and so is the grade, if there is one. A package deal.
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

// The grade of one student's part: a whole number from 0 to 100 (no decimals, no crumbs), or null to clear it.
export type TUpdateGradeDto = {
  grade: number | null;
};

export type TUpdateGradeResponse = {
  student: TAssignmentStudent;
};
