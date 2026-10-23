import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

// Reading the session cookie is a request-time read, so it lives behind a Suspense boundary
// (required by Cache Components). The skeleton is the only part prerendered; the rest streams in.
export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}

const AuthenticatedDashboard = async () => {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();

  // Not /auth directly: the cookie may still look valid to the proxy, which would bounce /auth back
  // to /dashboard in an endless loop. SESSION_EXPIRED_PATH clears the cookie first.
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  // The teacher id comes from the verified session, so a teacher only ever gets their own students.
  const students: TStudent[] = await getStudents(teacher.id);

  return <DashboardPage teacherName={teacher.name} students={students} />;
};
