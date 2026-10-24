import { ERROR_MESSAGES } from "@/constants/error.constant";
import { TApiFieldErrors } from "@/types/api.type";

export default class ApiError extends Error {
  status: number;
  fields?: TApiFieldErrors;

  constructor(message: string, status: number, fields?: TApiFieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    return new ApiError(ERROR_MESSAGES.network, 0);
  }
}
