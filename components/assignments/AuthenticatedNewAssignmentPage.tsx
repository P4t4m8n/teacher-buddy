import { redirect } from "next/navigation";
import AssignmentForm from "@/components/assignments/AssignmentForm";
import FormPage from "@/components/ui/FormPage";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

export default async function AuthenticatedNewAssignmentPage() {
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const students: TStudent[] = await getStudents(teacher.id);

  return (
    <FormPage title="מטלה חדשה" backHref={ASSIGNMENTS_PAGE} backLabel="חזרה לרשימת המטלות">
      <AssignmentForm students={students} />
    </FormPage>
  );
}
