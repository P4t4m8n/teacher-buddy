import { redirect } from "next/navigation";
import AssignmentsIndex from "@/components/assignments/AssignmentsIndex";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getAssignments } from "@/services/assignment.service";
import { getSessionTeacher } from "@/services/auth.service";
import type { TAssignmentListItem } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

export default async function AuthenticatedAssignmentsPage() {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const assignments: TAssignmentListItem[] = await getAssignments(teacher.id);

  return <AssignmentsIndex assignments={assignments} />;
}
