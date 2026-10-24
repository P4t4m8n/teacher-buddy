import { Suspense } from "react";
import AuthenticatedStudentPage from "@/components/students/AuthenticatedStudentPage";
import StudentPageSkeleton from "@/components/students/StudentPageSkeleton";

type TStudentPageProps = {
  params: Promise<{ id: string }>;
};

// The session cookie and the params are request-time reads, so they sit behind Suspense, like the dashboard.
export default function StudentPage({ params }: TStudentPageProps) {
  return (
    <Suspense fallback={<StudentPageSkeleton />}>
      <AuthenticatedStudentPage params={params} />
    </Suspense>
  );
}
