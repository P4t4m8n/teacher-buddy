import { notFound, redirect } from "next/navigation";
import AssignmentForm from "@/components/assignments/AssignmentForm";
import FormPage from "@/components/ui/FormPage";
import { ASSIGNMENTS_PAGE, getSampleTeacherAssignments } from "@/constants/assignment.constant";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { toFormValues } from "@/helpers/assignment";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TTeacherAssignment } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

type TAuthenticatedEditAssignmentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuthenticatedEditAssignmentPage({ params }: TAuthenticatedEditAssignmentPageProps) {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const { id } = await params;
  const students: TStudent[] = await getStudents(teacher.id);

  // Hardcoded sample until the assignments API exists.
  const assignment: TTeacherAssignment | undefined = getSampleTeacherAssignments(students).find(
    (sample: TTeacherAssignment) => sample.id === id,
  );
  if (!assignment) notFound();

  return (
    <FormPage title="עריכת מטלה" backHref={ASSIGNMENTS_PAGE} backLabel="חזרה לרשימת המטלות">
      <AssignmentForm students={students} assignment={toFormValues(assignment)} />
    </FormPage>
  );
}
