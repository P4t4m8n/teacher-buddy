"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { useFormSaveState } from "@/hooks/useFormSaveState";
import ApiError from "@/services/ApiError.client";
import { assignmentClientService } from "@/services/assignment.client.service";
import type { TCreateAssignmentDto } from "@/types/assignment.type";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";

type TUseAssignmentFormOptions = {
  // With an id the form updates that assignment. Without one it creates a new assignment.
  assignmentId?: string;
  // The saved data of the assignment that is edited, as text, so the form starts again when it changes.
  dataKey: string;
};

export const useAssignmentForm = ({ assignmentId, dataKey }: TUseAssignmentFormOptions) => {
  const router = useRouter();
  const { isPending, setIsPending, markSaved, formKey } = useFormSaveState(dataKey);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});

  const reset = (): void => {
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // The server validates everything and sends the messages, so the values are sent as they are.
    const form = new FormData(e.currentTarget);
    const dto: TCreateAssignmentDto = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      studentIds: form.getAll("studentIds").map(String),
    };

    setIsPending(true);
    reset();

    try {
      if (assignmentId) await assignmentClientService.updateAssignment(assignmentId, dto);
      else await assignmentClientService.createAssignment(dto);
      // Pending stays on until the page is hidden, so the form cannot be sent twice.
      markSaved();
      router.push(ASSIGNMENTS_PAGE);
    } catch (error: unknown) {
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
      setIsPending(false);
    }
  };

  return { isPending, errorMessage, fieldErrors, formKey, handleSubmit };
};
