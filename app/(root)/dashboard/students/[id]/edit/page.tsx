import { Suspense } from "react";
import AuthenticatedEditStudentPage from "@/components/students/AuthenticatedEditStudentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

interface IEditStudentPageProps {
  params: Promise<{ id: string }>;
}

// The session cookie and the params are request-time reads, so they must sit behind Suspense, tucked in like a toddler at bedtime.
export default function EditStudentPage({ params }: IEditStudentPageProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <AuthenticatedEditStudentPage params={params} />
    </Suspense>
  );
}
