import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { getLoginAttemptKey } from "@/lib/loginAttempt";
import { signInSchema } from "@/schemas/auth.schema";
import { signIn } from "@/services/auth.service";
import type { TSessionTeacher, TSignInDto } from "@/types/auth.type";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // A body that is not valid is refused first and is not counted: only real tries with a name are.
    const dto: TSignInDto = await parseBody(req, signInSchema);
    const teacher: TSessionTeacher = await signIn(dto, getLoginAttemptKey(req.headers, dto.name));
    return NextResponse.json({ teacher }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "POST /api/auth/login");
  }
}
