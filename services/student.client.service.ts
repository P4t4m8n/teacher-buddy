import { apiClientService } from "@/services/api.client.service";
import type { TCreateStudentDto, TCreateStudentResponse } from "@/types/student.type";

const STUDENTS_ENDPOINT = "students";

const createStudent = (dto: TCreateStudentDto): Promise<TCreateStudentResponse> => {
  return apiClientService.post<TCreateStudentDto, TCreateStudentResponse>(
    STUDENTS_ENDPOINT,
    dto,
  );
};

export const studentClientService = {
  createStudent,
};
