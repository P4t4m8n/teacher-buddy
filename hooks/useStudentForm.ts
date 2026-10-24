"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ApiError from "@/services/ApiError.client";
import { studentClientService } from "@/services/student.client.service";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";
import type { TCreateStudentDto } from "@/types/student.type";

type TUseStudentFormOptions = {
  onSaved: () => void;
};

export const useStudentForm = ({ onSaved }: TUseStudentFormOptions) => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});

  const reset = (): void => {
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
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
      await studentClientService.createStudent(dto);
      router.refresh();
      onSaved();
    } catch (error: unknown) {
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
    } finally {
      setIsPending(false);
    }
  };

  return { isPending, errorMessage, fieldErrors, handleSubmit, reset };
};
