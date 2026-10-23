export type TSignInDto = {
  name: string;
  idNumber: string;
};

export type TSessionTeacher = {
  id: string;
  name: string;
};

export type TSignInResponse = {
  teacher: TSessionTeacher;
};
