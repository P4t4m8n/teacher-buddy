import { Suspense } from "react";
import AuthenticatedNewStudentPage from "@/components/students/AuthenticatedNewStudentPage";
import StudentFormSkeleton from "@/components/students/StudentFormSkeleton";

// The session cookie is a request-time read, so it sits behind Suspense, like the dashboard.
export default function NewStudentPage() {
  return (
    <Suspense fallback={<StudentFormSkeleton />}>
      <AuthenticatedNewStudentPage />
    </Suspense>
  );
}
