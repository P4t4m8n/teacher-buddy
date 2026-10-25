export default function AssignmentPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex w-full max-w-3xl flex-col gap-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
