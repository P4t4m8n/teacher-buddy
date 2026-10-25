"use client";

import Link from "next/link";
import { useState } from "react";
import AssignmentDetails from "@/components/assignments/AssignmentDetails";
import AssignmentStatusBadge from "@/components/assignments/AssignmentStatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toStudentAssignment } from "@/helpers/assignment";
import { formatDate } from "@/helpers/date";
import type { TAssignmentStudent, TTeacherAssignment } from "@/types/assignment.type";

type TAssignmentStudentsProps = {
  assignment: TTeacherAssignment;
};

const HEADER_CELL_CLASSES =
  "bg-slate-50 px-4 py-3 text-start text-xs font-semibold tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400";

const getStudentPage = (studentId: string): string => `/dashboard/students/${studentId}`;

// The students of an assignment, with their status. The button of a row opens the same modal as on the
// student's own page: the details, the checked file and the upload.
export default function AssignmentStudents({ assignment }: TAssignmentStudentsProps) {
  const [selected, setSelected] = useState<TAssignmentStudent | null>(null);

  if (assignment.students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        המטלה עדיין לא ניתנה לאף תלמיד
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={HEADER_CELL_CLASSES}>
                תלמיד
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASSES} hidden md:table-cell`}>
                כיתה
              </th>
              <th scope="col" className={HEADER_CELL_CLASSES}>
                סטטוס
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASSES} hidden md:table-cell`}>
                הוגשה בתאריך
              </th>
              <th scope="col" className={HEADER_CELL_CLASSES}>
                ציון
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASSES} text-end`}>
                <span className="sr-only">פעולות</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {assignment.students.map((student: TAssignmentStudent) => (
              <tr key={student.studentId} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={getStudentPage(student.studentId)}
                    className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500"
                  >
                    {student.name}
                  </Link>
                  {/* On narrow screens the class moves under the name, to save a column. */}
                  <div className="text-xs text-slate-500 md:hidden dark:text-slate-400">{student.className}</div>
                </td>
                <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
                  {student.className}
                </td>
                <td className="px-4 py-3">
                  <AssignmentStatusBadge status={student.status} />
                </td>
                <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">
                  {student.submittedAt ? formatDate(student.submittedAt) : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{student.grade ?? "-"}</td>
                <td className="px-4 py-3 text-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-haspopup="dialog"
                    aria-label={`פרטים עבור ${student.name}`}
                    onClick={() => setSelected(student)}
                  >
                    פרטים
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? toStudentAssignment(assignment, selected).title : ""}
        size="lg"
      >
        {selected && <AssignmentDetails assignment={toStudentAssignment(assignment, selected)} />}
      </Modal>
    </>
  );
}
