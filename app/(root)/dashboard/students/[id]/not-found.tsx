import Link from "next/link";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

export default function StudentNotFound() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{ERROR_MESSAGES.studentNotFound}</h1>
      <Link href={DASHBOARD_PAGE} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        חזרה לרשימת התלמידים
      </Link>
    </div>
  );
}
