"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import DashboardTabsView from "@/components/dashboard/DashboardTabsView";

export default function DashboardTabs() {
  const segment: string | null = useSelectedLayoutSegment();

  return (
    <DashboardTabsView
      activeKey={segment === "assignments" ? "assignments" : "students"}
    />
  );
}
