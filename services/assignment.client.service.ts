import { apiClientService } from "@/services/api.client.service";
import type {
  TCreateAssignmentDto,
  TCreateAssignmentResponse,
  TUpdateAssignmentDto,
  TUpdateAssignmentResponse,
} from "@/types/assignment.type";

const ASSIGNMENTS_ENDPOINT = "assignments";

const createAssignment = (dto: TCreateAssignmentDto): Promise<TCreateAssignmentResponse> => {
  return apiClientService.post<TCreateAssignmentDto, TCreateAssignmentResponse>(ASSIGNMENTS_ENDPOINT, dto);
};

const updateAssignment = (assignmentId: string, dto: TUpdateAssignmentDto): Promise<TUpdateAssignmentResponse> => {
  return apiClientService.put<TUpdateAssignmentDto, TUpdateAssignmentResponse>(
    `${ASSIGNMENTS_ENDPOINT}/${assignmentId}`,
    dto,
  );
};

export const assignmentClientService = {
  createAssignment,
  updateAssignment,
};
