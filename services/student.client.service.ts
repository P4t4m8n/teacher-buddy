import { apiClientService } from "@/services/api.client.service";
import type {
  TCreateStudentDto,
  TCreateStudentResponse,
  TDeleteStudentResponse,
  TUpdateStudentDto,
  TUpdateStudentResponse,
} from "@/types/student.type";

const STUDENTS_ENDPOINT = "students";

const createStudent = (dto: TCreateStudentDto): Promise<TCreateStudentResponse> => {
  return apiClientService.post<TCreateStudentDto, TCreateStudentResponse>(
    STUDENTS_ENDPOINT,
    dto,
  );
};

const updateStudent = (studentId: string, dto: TUpdateStudentDto): Promise<TUpdateStudentResponse> => {
  return apiClientService.put<TUpdateStudentDto, TUpdateStudentResponse>(
    `${STUDENTS_ENDPOINT}/${studentId}`,
    dto,
  );
};

const deleteStudent = (studentId: string): Promise<TDeleteStudentResponse> => {
  return apiClientService.delete<TDeleteStudentResponse>(`${STUDENTS_ENDPOINT}/${studentId}`);
};

export const studentClientService = {
  createStudent,
  updateStudent,
  deleteStudent,
};
