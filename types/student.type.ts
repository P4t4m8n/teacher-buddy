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
