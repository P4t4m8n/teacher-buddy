import { Suspense } from "react";
import AuthenticatedEditStudentPage from "@/components/students/AuthenticatedEditStudentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

type TEditStudentPageProps = {
  params: Promise<{ id: string }>;
};

// The session cookie and the params are request-time reads, so they sit behind Suspense.
export default function EditStudentPage({ params }: TEditStudentPageProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <AuthenticatedEditStudentPage params={params} />
    </Suspense>
  );
}
