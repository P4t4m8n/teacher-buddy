import { ERROR_MESSAGES } from "@/constants/error.constant";
import type { TApiErrorBody } from "@/types/api.type";
import ApiError from "./ApiError.client";

const BASE_URL = "/api/";

type TApiService = {
  get<T>(endpoint: string, data?: unknown): Promise<T>;
  post<T, R>(endpoint: string, data?: T): Promise<R>;
  put<T, R>(endpoint: string, data?: T): Promise<R>;
  delete<T>(endpoint: string, data?: unknown): Promise<T>;
  buildQuery(filter: Record<string, unknown>): string;
};
type TMethod = "GET" | "POST" | "PUT" | "DELETE";

// An error body is JSON from API, but a proxy or a crashed server can answer with a grumpy HTML page instead.
const readErrorBody = async (res: Response): Promise<TApiErrorBody | null> => {
  try {
    return (await res.json()) as TApiErrorBody;
  } catch {
    return null;
  }
};

const ajax = async <T>(
  endpoint: string,
  method: TMethod = "GET",
  data: unknown = null,
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

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    // The request never got an answer: the connection is down or the server is unreachable (shouting into the void).
    throw new ApiError(ERROR_MESSAGES.network, 0);
  }

  if (!res.ok) {
    const body: TApiErrorBody | null = await readErrorBody(res);
    throw new ApiError(body?.error ?? ERROR_MESSAGES.internal, res.status, body?.fields);
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
