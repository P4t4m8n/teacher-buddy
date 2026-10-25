import { redirect } from "next/navigation";
import AssignmentsIndex from "@/components/assignments/AssignmentsIndex";
import { getSampleTeacherAssignments } from "@/constants/assignment.constant";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

export default async function AuthenticatedAssignmentsPage() {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const students: TStudent[] = await getStudents(teacher.id);

  // Hardcoded sample until the assignments API exists: given to the teacher's first students.
  return <AssignmentsIndex assignments={getSampleTeacherAssignments(students)} />;
}
