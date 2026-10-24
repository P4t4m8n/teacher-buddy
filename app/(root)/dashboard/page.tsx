import { Suspense } from "react";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import AuthenticatedDashboard from "@/components/dashboard/AuthenticatedDashboard";

// Reading the session cookie is a request-time read, so it lives behind a Suspense boundary
// The skeleton is the only part prerendered, the rest streams in.
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
