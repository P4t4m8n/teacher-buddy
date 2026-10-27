"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormSaveState } from "@/hooks/useFormSaveState";
import ApiError from "@/services/ApiError.client";
import { studentClientService } from "@/services/student.client.service";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";
import type { TCreateStudentDto } from "@/types/student.type";

type TUseStudentFormOptions = {
  // With an id the form updates that student. Without one it welcomes a brand new student.
  studentId?: string;
  // The saved data of the student being edited, as text, so the form takes it from the top when it changes.
  dataKey: string;
};

export const useStudentForm = ({ studentId, dataKey }: TUseStudentFormOptions) => {
  const router = useRouter();
  const { isPending, setIsPending, markSaved, formKey } = useFormSaveState(dataKey);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});

  const reset = (): void => {
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleSubmit = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const dto: TCreateStudentDto = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      classId: String(form.get("classId") ?? ""),
    };

    setIsPending(true);
    reset();

    try {
      if (studentId) await studentClientService.updateStudent(studentId, dto);
      else await studentClientService.createStudent(dto);
      // Pending stays on until the page is hidden, so the form cannot be sent twice, even by a twitchy finger.
      markSaved();
      router.push(DASHBOARD_PAGE);
    } catch (error: unknown) {
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
      setIsPending(false);
    }
  };

  return { isPending, errorMessage, fieldErrors, formKey, handleSubmit };
};
