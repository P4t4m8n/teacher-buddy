import StudentsTableSkeleton  from "@/components/students/StudentsTableSkeleton";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function DashboardSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-8 w-40 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mb-4 mt-8 h-6 w-32 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <StudentsTableSkeleton />
      </main>
    </div>
  );
}
