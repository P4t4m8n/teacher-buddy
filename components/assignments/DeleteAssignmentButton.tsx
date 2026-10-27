"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDeleteAssignment } from "@/hooks/useDeleteAssignment";
import { useDisclosure } from "@/hooks/useDisclosure";
import type { TAssignmentListItem } from "@/types/assignment.type";

type TDeleteAssignmentButtonProps = {
  assignment: TAssignmentListItem;
};

const describeSubmitted = (count: number): string =>
  count === 1 ? "תלמיד אחד כבר הגיש" : `${count} תלמידים כבר הגישו`;

export default function DeleteAssignmentButton({ assignment }: TDeleteAssignmentButtonProps) {
  const { isOpen, open, close } = useDisclosure();
  const { isPending, errorMessage, handleDelete, reset } = useDeleteAssignment({
    assignmentId: assignment.id,
    onDeleted: close,
  });

  const handleClose = (): void => {
    reset();
    close();
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`מחיקה עבור ${assignment.title}`}
      >
        מחיקה
      </Button>
      <Modal isOpen={isOpen} onClose={handleClose} title="מחיקת מטלה">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          למחוק את <strong>{assignment.title}</strong>? המטלה תוסר מכל התלמידים שקיבלו אותה, ולא ניתן לשחזר אותה.
        </p>

        {/* Students who submitted have a file and maybe a grade, which are deleted too: a stronger warning, with extra exclamation energy. */}
        {assignment.submittedCount > 0 && (
          <p
            role="note"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong>שימו לב:</strong> {describeSubmitted(assignment.submittedCount)} את המטלה. הקבצים שהועלו והציונים
            שניתנו יימחקו גם הם לצמיתות.
          </p>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            ביטול
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isPending}>
            {isPending ? "מוחק..." : "מחיקה"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
