export type TStudentClass = {
  id: string;
  name: string;
};

export type TStudent = {
  id: string;
  name: string;
  phone: string;
  class: TStudentClass;
};

// A minus in front is descending.
export type TStudentSort = "name" | "-name" | "class" | "-class" | "phone" | "-phone";

// What the students list is narrowed and ordered by. It is read from the address, so it is always valid.
export type TStudentListQuery = {
  // Looked for in the name and the phone. Empty: no search.
  search: string;
  // Empty: all the classes.
  classId: string;
  sort: TStudentSort;
  // 1-based. A page past the end shows the last page.
  page: number;
};

export type TStudentList = {
  // The students of the page shown.
  students: TStudent[];
  // All the teacher's students, whatever the query.
  total: number;
  // The students the query matches, on all the pages: the list shows "N of total".
  matched: number;
  // The page shown: the one asked for, or the last page when it is past the end.
  page: number;
  pageCount: number;
};

export type TGetStudentsResponse = {
  students: TStudent[];
};

export type TCreateStudentDto = {
  name: string;
  phone: string;
  classId: string;
};

export type TCreateStudentResponse = {
  student: TStudent;
};

// An update replaces all three fields, so it has the same shape as a create.
export type TUpdateStudentDto = TCreateStudentDto;

export type TUpdateStudentResponse = {
  student: TStudent;
};

export type TGetStudentResponse = {
  student: TStudent;
};

export type TDeleteStudentResponse = {
  id: string;
};

export type TStudentAction = {
  key: "details" | "edit";
  label: string;
  href: string;
};
