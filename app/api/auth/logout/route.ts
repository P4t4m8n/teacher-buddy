import { NextResponse } from "next/server";
import { signOut } from "@/services/auth.service";

export async function POST(): Promise<NextResponse> {
  try {
    await signOut();
    return NextResponse.json({ message: "Signed out" }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/auth/logout failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
