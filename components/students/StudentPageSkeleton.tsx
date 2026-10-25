export default function StudentPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="size-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
