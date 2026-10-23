import type { APIResponse } from "@playwright/test";

// The demo teacher created by `npm run db:seed`.
export const TEACHER = { name: "דנה כהן", idNumber: "123456789" };

// Next answers redirects with a relative Location (e.g. "/auth").
export const redirectPath = (response: APIResponse): string =>
  new URL(response.headers()["location"], "http://localhost").pathname;
