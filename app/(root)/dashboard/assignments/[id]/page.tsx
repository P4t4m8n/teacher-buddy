import { Suspense } from "react";
import AssignmentPageSkeleton from "@/components/assignments/AssignmentPageSkeleton";
import AuthenticatedAssignmentPage from "@/components/assignments/AuthenticatedAssignmentPage";

type TAssignmentPageProps = {
  params: Promise<{ id: string }>;
};

// The session cookie and the params are request-time reads, so they sit behind Suspense, politely waiting in the queue.
export default function AssignmentPage({ params }: TAssignmentPageProps) {
  return (
    <Suspense fallback={<AssignmentPageSkeleton />}>
      <AuthenticatedAssignmentPage params={params} />
    </Suspense>
  );
}
