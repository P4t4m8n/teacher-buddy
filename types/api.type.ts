export type TApiErrorBody = {
  error: string;
  fields?: Record<string, string[]>;
};

export type TApiFieldErrors = Record<string, string[]>;
