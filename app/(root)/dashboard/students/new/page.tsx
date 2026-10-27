import { Suspense } from "react";
import AuthenticatedNewStudentPage from "@/components/students/AuthenticatedNewStudentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

// The session cookie is a request-time read, so it sits behind Suspense.
export default function NewStudentPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <AuthenticatedNewStudentPage />
    </Suspense>
  );
}
