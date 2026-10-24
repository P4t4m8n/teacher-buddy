import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StudentDetails from "@/components/students/StudentDetails";
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
      <Link
        href={DASHBOARD_PAGE}
        className="w-fit text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        חזרה לרשימת התלמידים
      </Link>
      <StudentDetails student={student} />
    </div>
  );
}
