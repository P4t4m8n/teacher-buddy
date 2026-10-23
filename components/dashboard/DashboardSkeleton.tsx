import { BrandLogo } from "@/components/ui/BrandLogo";

// Shown while the session is being checked, so the header does not jump when the page streams in.
export const DashboardSkeleton = () => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </main>
    </div>
  );
};
