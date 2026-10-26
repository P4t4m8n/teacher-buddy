"use client";

import { useState } from "react";
import AssignmentDetails from "@/components/assignments/AssignmentDetails";
import AssignmentStatusBadge from "@/components/assignments/AssignmentStatusBadge";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/helpers/date";
import type { TStudentAssignment } from "@/types/assignment.type";

type TStudentAssignmentsProps = {
  assignments: TStudentAssignment[];
};

const HEADER_CELL_CLASSES =
  "bg-slate-50 px-4 py-3 text-start text-xs font-semibold tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400";

export default function StudentAssignments({ assignments }: TStudentAssignmentsProps) {
  // Only the id is kept, so the modal always shows the current data of the page, also after it was refreshed.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: TStudentAssignment | null = assignments.find(({ id }: TStudentAssignment) => id === selectedId) ?? null;

  if (assignments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        עדיין אין מטלות לתלמיד הזה
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
                שם המטלה
              </th>
              <th scope="col" className={HEADER_CELL_CLASSES}>
                הוגשה בתאריך
              </th>
              <th scope="col" className={HEADER_CELL_CLASSES}>
                ציון
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {assignments.map((assignment: TStudentAssignment) => (
              // The whole row opens the modal. The button inside is for the keyboard and screen readers.
              <tr
                key={assignment.id}
                onClick={() => setSelectedId(assignment.id)}
                className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-3 text-sm font-medium">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    className="text-start hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
                  >
                    {assignment.title}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {assignment.submittedAt ? formatDate(assignment.submittedAt) : <AssignmentStatusBadge status={assignment.status} />}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{assignment.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={selected !== null} onClose={() => setSelectedId(null)} title={selected?.title ?? ""} size="lg">
        {selected && <AssignmentDetails assignment={selected} onSaved={() => setSelectedId(null)} />}
      </Modal>
    </>
  );
}
