import { LogoutButton } from "@/components/auth/LogoutButton";
import { StudentsTable } from "@/components/students/StudentsTable";
import { BrandLogo } from "@/components/ui/BrandLogo";
import type { TStudent } from "@/types/student.type";

type TDashboardPageProps = {
  teacherName: string;
  students: TStudent[];
};

export const DashboardPage = ({ teacherName, students }: TDashboardPageProps) => {
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight">לוח בקרה</h1>
        <section aria-labelledby="students-heading" className="mt-8">
          <h2 id="students-heading" className="mb-4 text-lg font-semibold">
            התלמידים שלי <span className="text-slate-500 dark:text-slate-400">({students.length})</span>
          </h2>
          <StudentsTable students={students} />
        </section>
      </main>
    </div>
  );
};
