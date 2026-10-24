import Link from "next/link";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";

type TStudentFormPageProps = {
  title: string;
  children: React.ReactNode;
};

// The frame of the add and edit pages: a back link, the title and the form in a card.
export default function StudentFormPage({ title, children }: TStudentFormPageProps) {
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <Link
        href={DASHBOARD_PAGE}
        className="w-fit text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        חזרה לרשימת התלמידים
      </Link>
      <section className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </section>
    </div>
  );
}
