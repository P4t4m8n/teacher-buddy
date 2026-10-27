import { redirect } from "next/navigation";
import AssignmentsIndex from "@/components/assignments/AssignmentsIndex";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { parseAssignmentListQuery } from "@/schemas/assignment.schema";
import type { TSearchParams } from "@/schemas/list.schema";
import { getAssignmentList } from "@/services/assignment.service";
import { getSessionTeacher } from "@/services/auth.service";
import type { TAssignmentList, TAssignmentListQuery } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

type TAuthenticatedAssignmentsPageProps = {
  searchParams: Promise<TSearchParams>;
};

export default async function AuthenticatedAssignmentsPage({ searchParams }: TAuthenticatedAssignmentsPageProps) {
  // The proxy only checked the token's signature and expiry. This also checks the teacher still exists, roll call style.
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  const query: TAssignmentListQuery = parseAssignmentListQuery(await searchParams);
  const list: TAssignmentList = await getAssignmentList(teacher.id, query);

  return <AssignmentsIndex list={list} query={query} />;
}
