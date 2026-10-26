import { Suspense } from "react";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import AuthenticatedDashboard from "@/components/dashboard/AuthenticatedDashboard";
import type { TSearchParams } from "@/schemas/list.schema";

type TDashboardPageProps = {
  searchParams: Promise<TSearchParams>;
};

// Reading the session cookie and the search params are request-time reads, so they live behind a Suspense boundary
// The skeleton is the only part prerendered, the rest streams in.
export default function DashboardPage({ searchParams }: TDashboardPageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedDashboard searchParams={searchParams} />
    </Suspense>
  );
}
