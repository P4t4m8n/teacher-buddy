import { redirect } from "next/navigation";
import DashboardIndex from "@/components/dashboard/DashboardIndex";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { parseStudentListQuery } from "@/schemas/student.schema";
import type { TSearchParams } from "@/schemas/list.schema";
import { getSessionTeacher } from "@/services/auth.service";
import { getClasses } from "@/services/class.service";
import { getStudentList } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TClass } from "@/types/class.type";
import type { TStudentList, TStudentListQuery } from "@/types/student.type";

type TAuthenticatedDashboardProps = {
  searchParams: Promise<TSearchParams>;
};

export default async function AuthenticatedDashboard({ searchParams }: TAuthenticatedDashboardProps) {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists.
  const teacher: TSessionTeacher | null = await getSessionTeacher();

  // Not /auth directly: the cookie may still look valid to the proxy, which would bounce /auth back
  // to /dashboard in an endless loop. SESSION_EXPIRED_PATH clears the cookie first.
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const parsedQuery: TStudentListQuery = parseStudentListQuery(await searchParams);
  const classes: TClass[] = await getClasses(teacher.id);
  // A class that is not one of the teacher's (or was removed) is the same as no class, so the select
  // never shows a value it does not have.
  const query: TStudentListQuery = {
    ...parsedQuery,
    classId: classes.some((studentClass: TClass) => studentClass.id === parsedQuery.classId) ? parsedQuery.classId : "",
  };
  const list: TStudentList = await getStudentList(teacher.id, query);

  return <DashboardIndex list={list} classes={classes} query={query} />;
}
