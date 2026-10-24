import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signInSchema } from "@/schemas/auth.schema";
import {  signIn } from "@/services/auth.service";
import type { TSessionTeacher } from "@/types/auth.type";
import { INVALID_CREDENTIALS_MESSAGE } from "@/constants/auth.constant";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const dto: unknown = await req.json();
    const parsed = signInSchema.safeParse(dto);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      );
    }

    const teacher: TSessionTeacher = await signIn(parsed.data);
    return NextResponse.json({ teacher }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (error instanceof Error && error.message === INVALID_CREDENTIALS_MESSAGE) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
