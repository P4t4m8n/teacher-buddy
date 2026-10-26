"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import ApiError from "@/services/ApiError.client";
import { assignmentClientService } from "@/services/assignment.client.service";
import type { TCreateAssignmentDto } from "@/types/assignment.type";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";

export const useAssignmentForm = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});
  // The form is keyed on this, so a new key gives an empty form (the students and the editor keep their own state).
  const [formKey, setFormKey] = useState<number>(0);
  const isSaved = useRef<boolean>(false);

  // Next.js hides a page that was left instead of unmounting it, so after a save the form would come back with
  // the old values and a button that is still pending. When the page is hidden after a save, the form is reset.
  // A draft that was not saved is kept.
  useLayoutEffect(() => {
    return () => {
      if (!isSaved.current) return;
      isSaved.current = false;
      setIsPending(false);
      setFormKey((key: number) => key + 1);
    };
  }, []);

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
      await assignmentClientService.createAssignment(dto);
      // Pending stays on until the page is hidden, so the form cannot be sent twice.
      isSaved.current = true;
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
