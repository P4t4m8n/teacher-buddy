import { notFound, redirect } from "next/navigation";
import StudentForm from "@/components/students/StudentForm";
import StudentFormPage from "@/components/students/StudentFormPage";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getClasses } from "@/services/class.service";
import { findStudent } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TClass } from "@/types/class.type";
import type { TStudent } from "@/types/student.type";

type TAuthenticatedEditStudentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuthenticatedEditStudentPage({ params }: TAuthenticatedEditStudentPageProps) {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const { id } = await params;
  const [student, classes]: [TStudent | null, TClass[]] = await Promise.all([
    findStudent(teacher.id, id),
    getClasses(teacher.id),
  ]);
  if (!student) notFound();

  return (
    <StudentFormPage title="עריכת תלמיד">
      <StudentForm classes={classes} student={student} />
    </StudentFormPage>
  );
}
