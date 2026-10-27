"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { TSubmittedPart } from "@/types/assignment.type";

interface IConfirmRemovalModalProps {
  // The students who submitted and would be removed. Null: nothing to confirm, the dialog stays politely closed.
  parts: TSubmittedPart[] | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const describeGrade = (grade: number | null): string =>
  grade === null ? "הקובץ שהועלה" : `הקובץ שהועלה והציון ${grade}`;

// Asked before a save that removes students who already submitted, because their file and grade vanish
// with them and cannot be brought back, not even with a nice request. Cancelling goes back to the form, with nothing saved.
export default function ConfirmRemovalModal({
  parts,
  isPending,
  onConfirm,
  onCancel,
}: IConfirmRemovalModalProps) {
  return (
    <Modal
      isOpen={parts !== null}
      onClose={onCancel}
      title="הסרת תלמידים שהגישו"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {parts?.length === 1
          ? "תלמיד אחד כבר הגיש"
          : `${parts?.length} תלמידים כבר הגישו`}{" "}
        את המטלה, ובחרתם להסיר {parts?.length === 1 ? "אותו" : "אותם"} ממנה:
      </p>

      <ul className="flex flex-col gap-1.5 text-sm">
        {parts?.map((part: TSubmittedPart) => (
          <li
            key={part.studentId}
            className="flex flex-wrap items-baseline justify-between gap-x-3"
          >
            <strong>{part.name}</strong>
            <span className="text-slate-500 dark:text-slate-400">
              {describeGrade(part.grade)}
            </span>
          </li>
        ))}
      </ul>

      <p
        role="note"
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong>שימו לב:</strong> אם תמשיכו, הקבצים שהועלו והציונים שניתנו
        יימחקו לצמיתות, ולא ניתן יהיה לשחזר אותם.
      </p>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isPending}>
          חזרה לעריכה
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? "שומר..." : "הסרה ושמירה"}
        </Button>
      </div>
    </Modal>
  );
}
