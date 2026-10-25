import { notFound, redirect } from "next/navigation";
import AssignmentStudents from "@/components/assignments/AssignmentStudents";
import AssignmentSummary from "@/components/assignments/AssignmentSummary";
import { BackLink } from "@/components/ui/BackLink";
import { ASSIGNMENTS_PAGE, getSampleTeacherAssignments } from "@/constants/assignment.constant";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TTeacherAssignment } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

type TAuthenticatedAssignmentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuthenticatedAssignmentPage({ params }: TAuthenticatedAssignmentPageProps) {
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
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={ASSIGNMENTS_PAGE}>חזרה לרשימת המטלות</BackLink>
      <AssignmentSummary assignment={assignment} />
      <section aria-labelledby="assignment-students-heading" className="flex flex-col gap-4">
        <h2 id="assignment-students-heading" className="text-lg font-semibold">
          התלמידים במטלה
        </h2>
        <AssignmentStudents assignment={assignment} />
      </section>
    </div>
  );
}
