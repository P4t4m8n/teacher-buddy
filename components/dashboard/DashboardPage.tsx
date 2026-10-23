import { LogoutButton } from "@/components/auth/LogoutButton";
import { BrandLogo } from "@/components/ui/BrandLogo";

type TDashboardPageProps = {
  teacherName: string;
};

export const DashboardPage = ({ teacherName }: TDashboardPageProps) => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">לוח בקרה</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          רשימת התלמידים והמטלות תופיע כאן.
        </p>
      </main>
    </div>
  );
};
