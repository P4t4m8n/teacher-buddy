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
}
