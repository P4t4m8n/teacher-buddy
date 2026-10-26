import { Suspense } from "react";
import AuthenticatedAssignmentsPage from "@/components/assignments/AuthenticatedAssignmentsPage";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import type { TSearchParams } from "@/schemas/list.schema";

type TAssignmentsPageProps = {
  searchParams: Promise<TSearchParams>;
};

// The session cookie and the search params are request-time reads, so they sit behind Suspense, like the students list.
// The list has the same shape as the students list, so it uses the same skeleton.
export default function AssignmentsPage({ searchParams }: TAssignmentsPageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedAssignmentsPage searchParams={searchParams} />
    </Suspense>
  );
}
