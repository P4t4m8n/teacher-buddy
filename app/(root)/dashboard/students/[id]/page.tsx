import { Suspense } from "react";
import AuthenticatedStudentPage from "@/components/students/AuthenticatedStudentPage";
import StudentPageSkeleton from "@/components/students/StudentPageSkeleton";

interface IStudentPageProps {
  params: Promise<{ id: string }>;
}

// The session cookie and the params are request-time reads, so they sit behind Suspense.
export default function StudentPage({ params }: IStudentPageProps) {
  return (
    <Suspense fallback={<StudentPageSkeleton />}>
      <AuthenticatedStudentPage params={params} />
    </Suspense>
  );
}
