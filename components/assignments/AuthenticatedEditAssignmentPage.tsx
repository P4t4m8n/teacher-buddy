import { redirect } from "next/navigation";
import AssignmentForm from "@/components/assignments/AssignmentForm";
import FormPage from "@/components/ui/FormPage";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSampleAssignment } from "@/constants/assignment.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

export default async function AuthenticatedEditAssignmentPage() {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const students: TStudent[] = await getStudents(teacher.id);

  // Hardcoded sample until the assignments API exists: the id in the URL is not used yet.
  return (
    <FormPage title="עריכת מטלה">
      <AssignmentForm students={students} assignment={getSampleAssignment(students[0]?.id ?? "")} />
    </FormPage>
  );
}
