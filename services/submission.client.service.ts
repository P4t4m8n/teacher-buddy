import { apiClientService } from "@/services/api.client.service";
import type { TUpdateGradeDto, TUpdateGradeResponse, TUploadSubmissionResponse } from "@/types/assignment.type";

const getPartEndpoint = (assignmentId: string, studentId: string, part: "file" | "grade"): string =>
  `assignments/${assignmentId}/students/${studentId}/${part}`;

// The file goes as a form (multipart): the api client sends a FormData as it is, and the browser sets the type.
const uploadFile = (assignmentId: string, studentId: string, file: File): Promise<TUploadSubmissionResponse> => {
  const form = new FormData();
  form.set("file", file);
  return apiClientService.put<FormData, TUploadSubmissionResponse>(getPartEndpoint(assignmentId, studentId, "file"), form);
};

const saveGrade = (assignmentId: string, studentId: string, grade: number | null): Promise<TUpdateGradeResponse> => {
  return apiClientService.put<TUpdateGradeDto, TUpdateGradeResponse>(getPartEndpoint(assignmentId, studentId, "grade"), {
    grade,
  });
};

export const submissionClientService = {
  uploadFile,
  saveGrade,
};
