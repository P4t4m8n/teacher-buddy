import { redirect } from "next/navigation";
import { SESSION_EXPIRED_PATH } from "@/constants/auth.constant";
import { getSessionTeacher } from "@/services/auth.service";
import type { TSessionTeacher } from "@/types/auth.type";
import { BrandLogo } from "../ui/BrandLogo";
import LogoutButton from "../auth/LogoutButton";

export default async function DashboardHeader() {
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) redirect(SESSION_EXPIRED_PATH);

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <BrandLogo />
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {teacher.name}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
