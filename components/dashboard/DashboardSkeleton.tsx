import StudentsTableSkeleton  from "@/components/students/StudentsTableSkeleton";

export default function DashboardSkeleton() {
  return (
    <>
      <div className="h-8 w-40 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mb-4 mt-8 flex shrink-0 items-center justify-between gap-4">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
      <StudentsTableSkeleton />
    </>
  );
}
