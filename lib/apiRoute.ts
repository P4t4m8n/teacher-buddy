import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "@/lib/AppError";
import type { TApiErrorBody } from "@/types/api.type";

// zod's own messages (wrong type, missing field) become Hebrew too.
z.config(z.locales.he());

// Reads the JSON body and validates it. Throws an AppError, so the route needs no error code of its own:
// a body that is not JSON is a 400, and so is a body that fails the schema (with the field errors).
export const parseBody = async <T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw AppError.invalidJson();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw AppError.validation(z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  }
  return parsed.data;
};

// The catch block of every route handler. An AppError below 500 is an expected error, so its
// Hebrew message and status go to the client. Anything else is a bug or an outage: it is logged and
// the client only gets the generic message, so internal details never leak.
export const handleRouteError = (error: unknown, context: string): NextResponse<TApiErrorBody> => {
  if (error instanceof AppError && error.status < 500) {
    const body: TApiErrorBody = { error: error.message };
    if (error.fields) body.fields = error.fields;
    return NextResponse.json(body, { status: error.status });
  }

  console.error(`${context} failed:`, error);
  return NextResponse.json({ error: ERROR_MESSAGES.internal }, { status: 500 });
};
