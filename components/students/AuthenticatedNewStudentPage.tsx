import { redirect } from "next/navigation";
import StudentForm from "@/components/students/StudentForm";
import FormPage from "@/components/ui/FormPage";
import {
  DASHBOARD_PAGE,
  SESSION_EXPIRED_PATH,
} from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import { getClasses } from "@/services/class.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TClass } from "@/types/class.type";

export default async function AuthenticatedNewStudentPage() {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const classes: TClass[] = await getClasses(teacher.id);

  return (
    <FormPage
      title="הוספת תלמיד"
      backHref={DASHBOARD_PAGE}
      backLabel="חזרה לרשימת התלמידים"
    >
      <StudentForm classes={classes} />
    </FormPage>
  );
}
