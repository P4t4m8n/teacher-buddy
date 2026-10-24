const ROW_COUNT = 6;

export default function StudentsTableSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-11 shrink-0 bg-slate-50 dark:bg-slate-800/50" />
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: ROW_COUNT }, (_, index: number) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="size-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="ms-auto h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
