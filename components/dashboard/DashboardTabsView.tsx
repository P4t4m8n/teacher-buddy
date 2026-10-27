import Link from "next/link";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";

export type TDashboardTabKey = "students" | "assignments";

type TTab = {
  key: TDashboardTabKey;
  label: string;
  href: string;
};

const TABS: TTab[] = [
  { key: "students", label: "תלמידים", href: DASHBOARD_PAGE },
  { key: "assignments", label: "מטלות", href: ASSIGNMENTS_PAGE },
];

const BASE_CLASSES =
  "-mb-px border-b-2 px-4 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-indigo-500";
const ACTIVE_CLASSES =
  "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300";
const IDLE_CLASSES =
  "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200";

interface TDashboardTabsViewProps {
  // The tab that is open. None, while the page is still working out which one it is (it is thinking, give it a second).
  activeKey: TDashboardTabKey | null;
}


export default function DashboardTabsView({
  activeKey,
}: TDashboardTabsViewProps) {
  return (
    <nav
      aria-label="אזורי הלוח"
      className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto flex w-full max-w-6xl gap-1 px-2 sm:px-4">
        {TABS.map((tab: TTab) => {
          const isActive: boolean = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`${BASE_CLASSES} ${isActive ? ACTIVE_CLASSES : IDLE_CLASSES}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
