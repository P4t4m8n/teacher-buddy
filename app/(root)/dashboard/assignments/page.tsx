import { Suspense } from "react";
import AuthenticatedAssignmentsPage from "@/components/assignments/AuthenticatedAssignmentsPage";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

// The session cookie is a request-time read, so it sits behind Suspense, like the students list.
// The list has the same shape as the students list, so it uses the same skeleton.
export default function AssignmentsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedAssignmentsPage />
    </Suspense>
  );
}
