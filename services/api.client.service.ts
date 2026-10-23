import type { TApiErrorBody, TApiFieldErrors } from "@/types/api.type";

const BASE_URL = "/api/";

// Minimal placeholder so callers can read the status and field errors; to be replaced by the error service.
export class ApiError extends Error {
  status: number;
  fields?: TApiFieldErrors;

  constructor(message: string, status: number, fields?: TApiFieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

type TApiService = {
  get<T>(endpoint: string, data?: unknown): Promise<T>;
  post<T, R>(endpoint: string, data?: T): Promise<R>;
  put<T, R>(endpoint: string, data?: T): Promise<R>;
  delete<T>(endpoint: string, data?: unknown): Promise<T>;
  buildQuery(filter: Record<string, unknown>): string;
};
type TMethod = "GET" | "POST" | "PUT" | "DELETE";

const ajax = async <T>(
  endpoint: string,
  method: TMethod = "GET",
  data: unknown = null
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    credentials: "include",
    headers: {
      ...(data instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
  };

  if (method !== "GET" && data) {
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  } else if (method === "GET" && data) {
    const queryParams = new URLSearchParams(data as Record<string, string>);
    endpoint += `?${queryParams.toString()}`;
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const body: TApiErrorBody = await res.json();
    throw new ApiError(body.error, res.status, body.fields);
  }

  return (await res.json()) as T;
};

const buildQuery = (filter: Record<string, string>) => {
  let query = "?";
  Object.entries(filter).forEach(([key, value]) => {
    if (!value) return;
    query += `${key}=${value}&`;
  });
  return query;
};

export const apiClientService: TApiService = {
  get(endpoint, data) {
    return ajax(endpoint, "GET", data);
  },
  post(endpoint, data) {
    return ajax(endpoint, "POST", data);
  },
  put(endpoint, data) {
    return ajax(endpoint, "PUT", data);
  },
  delete(endpoint, data) {
    return ajax(endpoint, "DELETE", data);
  },
  buildQuery,
};
