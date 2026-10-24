"use client";

import StudentForm from "@/components/students/StudentForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDisclosure } from "@/hooks/useDisclosure";
import type { TClass } from "@/types/class.type";

type TAddStudentButtonProps = {
  classes: TClass[];
};

export default function AddStudentButton({ classes }: TAddStudentButtonProps) {
  const { isOpen, open, close } = useDisclosure();

  return (
    <>
      <Button size="sm" onClick={open} aria-haspopup="dialog">
        הוספת תלמיד
      </Button>
      <Modal isOpen={isOpen} onClose={close} title="הוספת תלמיד">
        <StudentForm classes={classes} onSaved={close} onCancel={close} />
      </Modal>
    </>
  );
}
