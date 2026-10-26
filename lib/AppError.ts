import { ERROR_MESSAGES } from "@/constants/error.constant";
import type { TApiFieldErrors } from "@/types/api.type";

// Every error the backend throws on purpose. A service throws it, and handleRouteError turns it
// into the response: `status` is the HTTP status and `message` is the Hebrew text for the client.
export class AppError extends Error {
  readonly status: number;
  readonly fields?: TApiFieldErrors;

  constructor(message: string, status: number, fields?: TApiFieldErrors) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.fields = fields;
  }

  static unauthorized(): AppError {
    return new AppError(ERROR_MESSAGES.unauthorized, 401);
  }

  static invalidCredentials(): AppError {
    return new AppError(ERROR_MESSAGES.invalidCredentials, 401);
  }

  static validation(fields: TApiFieldErrors): AppError {
    return new AppError(ERROR_MESSAGES.validation, 400, fields);
  }

  static invalidJson(): AppError {
    return new AppError(ERROR_MESSAGES.invalidJson, 400);
  }

  static invalidFormData(): AppError {
    return new AppError(ERROR_MESSAGES.invalidFormData, 400);
  }

  static fileTooLarge(): AppError {
    return new AppError(ERROR_MESSAGES.fileTooLarge, 413);
  }

  static fileNotFound(): AppError {
    return new AppError(ERROR_MESSAGES.fileNotFound, 404);
  }

  static classNotFound(): AppError {
    return new AppError(ERROR_MESSAGES.classNotFound, 404);
  }

  static studentNotFound(): AppError {
    return new AppError(ERROR_MESSAGES.studentNotFound, 404);
  }

  static studentExists(): AppError {
    return new AppError(ERROR_MESSAGES.studentExists, 409);
  }

  static assignmentNotFound(): AppError {
    return new AppError(ERROR_MESSAGES.assignmentNotFound, 404);
  }

  static assignmentStudentSubmitted(): AppError {
    return new AppError(ERROR_MESSAGES.assignmentStudentSubmitted, 409);
  }

  // For failures the client cannot fix, like a missing config value. `detail` is for the log only:
  // handleRouteError never sends the message of a 5xx error to the client.
  static internal(detail: string): AppError {
    return new AppError(detail, 500);
  }
}
