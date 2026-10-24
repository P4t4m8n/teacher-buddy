import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { signInSchema } from "@/schemas/auth.schema";
import { signIn } from "@/services/auth.service";
import type { TSessionTeacher, TSignInDto } from "@/types/auth.type";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const dto: TSignInDto = await parseBody(req, signInSchema);
    const teacher: TSessionTeacher = await signIn(dto);
    return NextResponse.json({ teacher }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "POST /api/auth/login");
  }
}
