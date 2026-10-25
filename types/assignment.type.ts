// What the assignment form edits. The description is HTML from the rich text editor.
export type TAssignmentFormValues = {
  title: string;
  studentId: string;
  // yyyy-mm-dd, the format of a date input.
  dueDate: string;
  description: string;
};
