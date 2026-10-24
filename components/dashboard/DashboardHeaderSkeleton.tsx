import { BrandLogo } from "../ui/BrandLogo";

export default function DashboardHeaderSkeleton() {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <BrandLogo />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </header>
  );
}
