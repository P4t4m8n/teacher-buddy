"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ApiError from "@/services/ApiError.client";
import { assignmentClientService } from "@/services/assignment.client.service";

type TUseDeleteAssignmentOptions = {
  assignmentId: string;
  onDeleted: () => void;
};

export const useDeleteAssignment = ({ assignmentId, onDeleted }: TUseDeleteAssignmentOptions) => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = (): void => setErrorMessage(null);

  const handleDelete = async (): Promise<void> => {
    setIsPending(true);
    reset();

    try {
      await assignmentClientService.deleteAssignment(assignmentId);
      // The list reads the database on the server, so it gets a nudge to wave goodbye to the row.
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
