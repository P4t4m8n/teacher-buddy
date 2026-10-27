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

// A minus in front means descending, like a tiny downhill slide.
export type TStudentSort = "name" | "-name" | "class" | "-class" | "phone" | "-phone";

// What the students list is narrowed and ordered by. It is read from the address, so it is always valid (the bouncer at the door checks it).
export type TStudentListQuery = {
  // Hunted for in the name and the phone. Empty: no hunting.
  search: string;
  // Empty: all the classes, invited to the party at once.
  classId: string;
  sort: TStudentSort;
  // 1-based, like counting people in a queue. A page past the end shows the last page.
  page: number;
};

export type TStudentList = {
  // The students of the page shown, front row only.
  students: TStudent[];
  // All the teacher's students, whatever the query: the full headcount.
  total: number;
  // The students the query matches, on all the pages: the list proudly shows "N of total".
  matched: number;
  // The page shown: the one asked for, or the last page when the request wandered past the end.
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

// An update replaces all three fields, so it is a create wearing a different hat (same shape).
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
