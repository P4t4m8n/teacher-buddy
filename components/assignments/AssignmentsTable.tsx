import Link from "next/link";
import {
  getAssignmentEditPage,
  getAssignmentPage,
} from "@/constants/assignment.constant";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatDate } from "@/helpers/date";
import type { TAssignmentListItem } from "@/types/assignment.type";

type TAssignmentsTableProps = {
  assignments: TAssignmentListItem[];
};

const HEADER_CELL_CLASSES =
  "sticky top-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400";

export default function AssignmentsTable({
  assignments,
}: TAssignmentsTableProps) {
  if (assignments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        עדיין אין מטלות
      </p>
    );
  }

  return (
    <div
      role="region"
      aria-label="רשימת המטלות"
      tabIndex={0}
      className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900"
    >
      <table className="w-full border-collapse">
        <AssigmentHeader />
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {assignments.map((assignment: TAssignmentListItem) => (
            <AssignmentRow key={assignment.id} assignment={assignment} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const AssigmentHeader = () => {
  return (
    <thead>
      <tr>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-start`}>
          שם המטלה
        </th>
        <th
          scope="col"
          className={`${HEADER_CELL_CLASSES} hidden text-start md:table-cell`}
        >
          תאריך הגשה
        </th>
        <th
          scope="col"
          className={`${HEADER_CELL_CLASSES} hidden text-start md:table-cell`}
        >
          תלמידים
        </th>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-start`}>
          הוגשו
        </th>
        <th scope="col" className={`${HEADER_CELL_CLASSES} text-end`}>
          פעולות
        </th>
      </tr>
    </thead>
  );
};

const AssignmentRow = ({ assignment }: { assignment: TAssignmentListItem }) => {
  const { id, title, dueDate, studentCount, submittedCount } = assignment;
  return (
    <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <Link
          href={getAssignmentPage(id)}
          className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          {title}
        </Link>
        {/* On narrow screens the due date moves under the name, to save a column. */}
        <div className="text-xs text-slate-500 md:hidden dark:text-slate-400">
          להגשה עד {formatDate(dueDate)}
        </div>
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
        {formatDate(dueDate)}
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
        {studentCount}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {submittedCount} מתוך {studentCount}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LinkButton
            href={getAssignmentPage(id)}
            size="sm"
            aria-label={`פרטים עבור ${title}`}
          >
            פרטים
          </LinkButton>
          <LinkButton
            href={getAssignmentEditPage(id)}
            size="sm"
            aria-label={`עריכה עבור ${title}`}
          >
            עריכה
          </LinkButton>
        </div>
      </td>
    </tr>
  );
};
