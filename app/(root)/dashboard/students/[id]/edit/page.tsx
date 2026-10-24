import { Suspense } from "react";
import AuthenticatedEditStudentPage from "@/components/students/AuthenticatedEditStudentPage";
import StudentFormSkeleton from "@/components/students/StudentFormSkeleton";

type TEditStudentPageProps = {
  params: Promise<{ id: string }>;
};

// The session cookie and the params are request-time reads, so they sit behind Suspense.
export default function EditStudentPage({ params }: TEditStudentPageProps) {
  return (
    <Suspense fallback={<StudentFormSkeleton />}>
      <AuthenticatedEditStudentPage params={params} />
    </Suspense>
  );
}
