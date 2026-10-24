import { Suspense } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardHeaderSkeleton from "@/components/dashboard/DashboardHeaderSkeleton";

type TDashboardLayoutProps = {
  children: React.ReactNode;
};

// The header is shared by every dashboard page. h-dvh fixes the frame to the viewport, so a page can
// scroll only the part it chooses (the students list), never the whole page.
export default function DashboardLayout({ children }: TDashboardLayoutProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
