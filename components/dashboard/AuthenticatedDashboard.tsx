import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import { TSessionTeacher } from "@/types/auth.type";
import { TStudent } from "@/types/student.type";
import { redirect } from "next/navigation";
import DashboardIndex from "./DashboardIndex";

export default async function AuthenticatedDashboard() {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();

  // Not /auth directly: the cookie may still look valid to the proxy, which would bounce /auth back
  // to /dashboard in an endless loop. SESSION_EXPIRED_PATH clears the cookie first.
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const students: TStudent[] = await getStudents(teacher.id);

  return <DashboardIndex teacherName={teacher.name} students={students} />;
}
