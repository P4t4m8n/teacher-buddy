import { notFound, redirect } from "next/navigation";
import StudentAssignments from "@/components/assignments/StudentAssignments";
import StudentDetails from "@/components/students/StudentDetails";
import { BackLink } from "@/components/ui/BackLink";
import { LinkButton } from "@/components/ui/LinkButton";
import { NEW_ASSIGNMENT_PAGE, SAMPLE_STUDENT_ASSIGNMENTS } from "@/constants/assignment.constant";
import { DASHBOARD_PAGE, SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { findStudent } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

type TAuthenticatedStudentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuthenticatedStudentPage({ params }: TAuthenticatedStudentPageProps) {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const { id } = await params;
  const student: TStudent | null = await findStudent(teacher.id, id);
  if (!student) notFound();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={DASHBOARD_PAGE}>חזרה לרשימת התלמידים</BackLink>
      <StudentDetails student={student} />
      <section aria-labelledby="assignments-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="assignments-heading" className="text-lg font-semibold">
            מטלות
          </h2>
          <LinkButton href={NEW_ASSIGNMENT_PAGE} variant="primary" size="sm">
            מטלה חדשה
          </LinkButton>
        </div>
        {/* Hardcoded sample until the assignments API exists: every student shows the same list. */}
        <StudentAssignments assignments={SAMPLE_STUDENT_ASSIGNMENTS} />
      </section>
    </div>
  );
}
