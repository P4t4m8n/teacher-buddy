import { Suspense } from "react";
import AuthenticatedEditAssignmentPage from "@/components/assignments/AuthenticatedEditAssignmentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

// The session cookie is a request-time read, so it sits behind Suspense, like the dashboard.
export default function EditAssignmentPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <AuthenticatedEditAssignmentPage />
    </Suspense>
  );
}
