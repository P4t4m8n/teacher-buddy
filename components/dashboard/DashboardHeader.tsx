import { BrandLogo } from "../ui/BrandLogo";
import LogoutButton from "../auth/LogoutButton";

interface DashboardHeaderProps {
  teacherName: string;
}
export default function DashboardHeader({ teacherName }: DashboardHeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <BrandLogo />
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {teacherName}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
