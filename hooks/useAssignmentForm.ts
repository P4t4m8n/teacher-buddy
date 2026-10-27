"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { useFormSaveState } from "@/hooks/useFormSaveState";
import ApiError from "@/services/ApiError.client";
import { assignmentClientService } from "@/services/assignment.client.service";
import type {
  TSubmittedPart,
  TUpdateAssignmentDto,
} from "@/types/assignment.type";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";

interface IUseAssignmentFormOptions {
  // With an id the form updates that assignment. Without one it bakes a brand new assignment.
  assignmentId?: string;
  // The saved data of the assignment being edited, as text, so the form starts over like a fresh notebook when it changes.
  dataKey: string;
  // The students who already handed in the assignment. Removing one deletes their file and grade, so we ask twice, politely.
  submittedParts: TSubmittedPart[];
}

// A save holding its breath until the teacher confirms: the form's values and the students who submitted and would be removed.
type TPendingRemoval = {
  dto: TUpdateAssignmentDto;
  parts: TSubmittedPart[];
};

export const useAssignmentForm = ({
  assignmentId,
  dataKey,
  submittedParts,
}: IUseAssignmentFormOptions) => {
  const router = useRouter();
  const { isPending, setIsPending, markSaved, formKey } =
    useFormSaveState(dataKey);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});
  const [pendingRemoval, setPendingRemoval] = useState<TPendingRemoval | null>(
    null,
  );

  const reset = (): void => {
    setErrorMessage(null);
    setFieldErrors({});
  };

  const save = async (dto: TUpdateAssignmentDto): Promise<void> => {
    setIsPending(true);
    reset();

    try {
      if (assignmentId)
        await assignmentClientService.updateAssignment(assignmentId, dto);
      else await assignmentClientService.createAssignment(dto);
      // Pending stays on until the page is hidden, so an excited double click cannot send the form twice.
      markSaved();
      router.push(ASSIGNMENTS_PAGE);
    } catch (error: unknown) {
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
      setIsPending(false);
      setPendingRemoval(null);
    }
  };

  const handleSubmit = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    // The server validates everything and sends the messages, so the values travel as they are, no packing tape needed.
    const form = new FormData(e.currentTarget);
    const dto: TUpdateAssignmentDto = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      studentIds: form.getAll("studentIds").map(String),
    };

    // Students who submitted and are no longer chosen: ask before their file and grade vanish. The server
    // refuses this without the confirmation too, so this is just the polite question, not the bouncer at the door.
    const removedParts: TSubmittedPart[] = assignmentId
      ? submittedParts.filter(
          (part: TSubmittedPart) => !dto.studentIds.includes(part.studentId),
        )
      : [];
    if (removedParts.length > 0) {
      reset();
      setPendingRemoval({ dto, parts: removedParts });
      return;
    }

    await save(dto);
  };

  const confirmRemoval = async (): Promise<void> => {
    if (!pendingRemoval) return;

    const { dto, parts }: TPendingRemoval = pendingRemoval;
    await save({
      ...dto,
      confirmedRemovalIds: parts.map((part: TSubmittedPart) => part.studentId),
    });
  };

  const cancelRemoval = (): void => setPendingRemoval(null);

  return {
    isPending,
    errorMessage,
    fieldErrors,
    formKey,
    handleSubmit,
    removedParts: pendingRemoval?.parts ?? null,
    confirmRemoval,
    cancelRemoval,
  };
};
