import { notFound, redirect } from "next/navigation";
import AssignmentForm from "@/components/assignments/AssignmentForm";
import FormPage from "@/components/ui/FormPage";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { toFormValues, toSubmittedParts } from "@/helpers/assignment";
import { findAssignment } from "@/services/assignment.service";
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
  const [assignment, students]: [TTeacherAssignment | null, TStudent[]] = await Promise.all([
    findAssignment(teacher.id, id),
    getStudents(teacher.id),
  ]);
  if (!assignment) notFound();

  return (
    <FormPage title="עריכת מטלה" backHref={ASSIGNMENTS_PAGE} backLabel="חזרה לרשימת המטלות">
      <AssignmentForm
        students={students}
        assignment={{ id: assignment.id, ...toFormValues(assignment) }}
        submittedParts={toSubmittedParts(assignment)}
      />
    </FormPage>
  );
}
