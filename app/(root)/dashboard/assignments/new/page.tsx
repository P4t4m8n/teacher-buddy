import { Suspense } from "react";
import AuthenticatedNewAssignmentPage from "@/components/assignments/AuthenticatedNewAssignmentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

// The session cookie is a request-time read, so it sits behind Suspense, like the dashboard.
export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <AuthenticatedNewAssignmentPage />
    </Suspense>
  );
}
