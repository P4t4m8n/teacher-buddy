type TFormSkeletonProps = {
  // How many fields the form has. Defaults to the three of the student form, a tidy little trio.
  fields?: number;
};

export default function FormSkeleton({ fields = 3 }: TFormSkeletonProps) {
  return (
    <div aria-hidden="true" className="flex w-full max-w-xl flex-col gap-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        {Array.from({ length: fields }, (_, field: number) => (
          <div key={field} className="flex flex-col gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-11 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
