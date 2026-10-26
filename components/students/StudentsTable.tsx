import StudentActions from "@/components/students/StudentActions";
import type { TStudent } from "@/types/student.type";

type TStudentsTableProps = {
  students: TStudent[];
  // A search or a filter is on: an empty list then means nothing matched, not that there are no students.
  isFiltered: boolean;
};

const HEADER_CELL_CLASSES =
  "sticky top-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400";

export default function StudentsTable({ students, isFiltered }: TStudentsTableProps) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {isFiltered ? "לא נמצאו תלמידים שמתאימים לחיפוש" : "עדיין אין תלמידים"}
      </p>
    );
  }

  return (
    <div
      role="region"
      aria-label="רשימת התלמידים"
      tabIndex={0}
      className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900"
    >
      <table className="w-full border-collapse">
        <TableHead />
        <TableBody students={students} />
      </table>
    </div>
  );
}

const TableHead = () => {
  return (
    <thead>
      <tr>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-start`}>
          שם
        </th>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-start`}>
          כיתה
        </th>
        <th
          scope="col"
          className={`${HEADER_CELL_CLASSES} hidden text-start md:table-cell`}
        >
          טלפון
        </th>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-end`}>
          פעולות
        </th>
      </tr>
    </thead>
  );
};

const TableBody = ({ students }: { students: TStudent[] }) => {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
      {students.map((student: TStudent) => (
        <TableRow key={student.id} student={student} />
      ))}
    </tbody>
  );
};

const TableRow = ({ student }: { student: TStudent }) => {
  return (
    <tr
      key={student.id}
      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
          >
            {student.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{student.name}</div>
            {/* On narrow screens the phone moves under the name, to save a column. */}
            <span
              dir="ltr"
              className="inline-block whitespace-nowrap text-xs text-slate-500 md:hidden dark:text-slate-400"
            >
              {student.phone}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {student.class.name}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
        <span dir="ltr" className="inline-block">
          {student.phone}
        </span>
      </td>
      <td className="px-4 py-3">
        <StudentActions student={student} />
      </td>
    </tr>
  );
};
