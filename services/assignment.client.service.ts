import { apiClientService } from "@/services/api.client.service";
import type { TCreateAssignmentDto, TCreateAssignmentResponse } from "@/types/assignment.type";

const ASSIGNMENTS_ENDPOINT = "assignments";

const createAssignment = (dto: TCreateAssignmentDto): Promise<TCreateAssignmentResponse> => {
  return apiClientService.post<TCreateAssignmentDto, TCreateAssignmentResponse>(ASSIGNMENTS_ENDPOINT, dto);
};

export const assignmentClientService = {
  createAssignment,
};
