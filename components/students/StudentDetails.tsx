import type { TStudent } from "@/types/student.type";

interface IStudentDetailsProps {
  student: TStudent;
}

export default function StudentDetails({ student }: IStudentDetailsProps) {
  return (
    <section
      aria-label="פרטי תלמיד"
      className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
        >
          {student.name.charAt(0)}
        </span>
        <h1 className="min-w-0 wrap-break-word text-2xl font-bold tracking-tight">
          {student.name}
        </h1>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">כיתה</dt>
        <dd>{student.class.name}</dd>
        <dt className="text-slate-500 dark:text-slate-400">טלפון</dt>
        <dd>
          <span dir="ltr" className="inline-block">
            {student.phone}
          </span>
        </dd>
      </dl>
    </section>
  );
}
