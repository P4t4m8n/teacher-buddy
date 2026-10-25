import { Suspense } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardHeaderSkeleton from "@/components/dashboard/DashboardHeaderSkeleton";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import DashboardTabsView from "@/components/dashboard/DashboardTabsView";

type TDashboardLayoutProps = {
  children: React.ReactNode;
};

// The header and the tabs are shared by every dashboard page. h-dvh fixes the frame to the viewport, so a
// page can scroll only the part it chooses (a list), never the whole page.
export default function DashboardLayout({ children }: TDashboardLayoutProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>
      {/* Reading the address is a request-time read, so it sits behind Suspense. Until it is known the bar shows without an active tab. */}
      <Suspense fallback={<DashboardTabsView activeKey={null} />}>
        <DashboardTabs />
      </Suspense>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
