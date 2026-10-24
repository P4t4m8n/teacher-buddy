export type TApiErrorBody = {
  error: string;
  fields?: Record<string, string[]>;
};

export type TApiFieldErrors = Record<string, string[]>;

// What a form shows after a failed request: errors under the inputs, or one message for the whole form.
export type TFormErrors = {
  errorMessage: string | null;
  fieldErrors: TApiFieldErrors;
};
