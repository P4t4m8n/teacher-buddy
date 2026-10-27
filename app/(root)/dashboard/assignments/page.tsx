import { Suspense } from "react";
import AuthenticatedAssignmentsPage from "@/components/assignments/AuthenticatedAssignmentsPage";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import type { TSearchParams } from "@/schemas/list.schema";

interface IAssignmentsPageProps {
  searchParams: Promise<TSearchParams>;
}

// The session cookie and the search params are request-time reads, so they sit behind Suspense.
// The list has the same shape as the students list, so it borrows the same skeleton (bones are bones).
export default function AssignmentsPage({
  searchParams,
}: IAssignmentsPageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedAssignmentsPage searchParams={searchParams} />
    </Suspense>
  );
}
