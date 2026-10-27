import { Suspense } from "react";
import AuthenticatedEditAssignmentPage from "@/components/assignments/AuthenticatedEditAssignmentPage";
import FormSkeleton from "@/components/ui/FormSkeleton";

type TEditAssignmentPageProps = {
  params: Promise<{ id: string }>;
};

// The session cookie and the params are request-time reads, so they sit behind Suspense, like cookies in a jar with a lid.
export default function EditAssignmentPage({ params }: TEditAssignmentPageProps) {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <AuthenticatedEditAssignmentPage params={params} />
    </Suspense>
  );
}
