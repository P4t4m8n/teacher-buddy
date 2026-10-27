"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ApiError from "@/services/ApiError.client";
import { studentClientService } from "@/services/student.client.service";

interface IUseDeleteStudentOptions {
  studentId: string;
  onDeleted: () => void;
}

export const useDeleteStudent = ({
  studentId,
  onDeleted,
}: IUseDeleteStudentOptions) => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = (): void => setErrorMessage(null);

  const handleDelete = async (): Promise<void> => {
    setIsPending(true);
    reset();

    try {
      await studentClientService.deleteStudent(studentId);
      router.refresh();
      onDeleted();
    } catch (error: unknown) {
      setErrorMessage(ApiError.from(error).message);
    } finally {
      setIsPending(false);
    }
  };

  return { isPending, errorMessage, handleDelete, reset };
};
