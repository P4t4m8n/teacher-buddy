"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDeleteStudent } from "@/hooks/useDeleteStudent";
import { useDisclosure } from "@/hooks/useDisclosure";
import type { TStudent } from "@/types/student.type";

interface IDeleteStudentButtonProps {
  student: TStudent;
}

export default function DeleteStudentButton({
  student,
}: IDeleteStudentButtonProps) {
  const { isOpen, open, close } = useDisclosure();
  const { isPending, errorMessage, handleDelete, reset } = useDeleteStudent({
    studentId: student.id,
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
        aria-label={`מחיקה עבור ${student.name}`}
      >
        מחיקה
      </Button>
      <Modal isOpen={isOpen} onClose={handleClose} title="מחיקת תלמיד">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          למחוק את <strong>{student.name}</strong>? כל המטלות והציונים של התלמיד
          יימחקו גם הם, ולא ניתן לשחזר אותם.
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
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
