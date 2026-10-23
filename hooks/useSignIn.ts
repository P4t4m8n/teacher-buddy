"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/services/api.client.service";
import { authClientService } from "@/services/auth.client.service";
import type { TApiFieldErrors } from "@/types/api.type";
import type { TSignInDto } from "@/types/auth.type";

const INVALID_CREDENTIALS_TEXT = "שם או תעודת זהות שגויים";
const GENERIC_ERROR_TEXT = "אירעה שגיאה, נסו שוב מאוחר יותר";

export const useSignIn = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});

  const handleSubmit = async (
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const dto: TSignInDto = {
      name: String(form.get("name") ?? ""),
      idNumber: String(form.get("idNumber") ?? ""),
    };

    try {
      await authClientService.signIn(dto);
      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setIsPending(false);
      if (error instanceof ApiError && error.status === 400 && error.fields) {
        setFieldErrors(error.fields);
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage(INVALID_CREDENTIALS_TEXT);
        return;
      }
      setErrorMessage(GENERIC_ERROR_TEXT);
    }
  };

  return { isPending, errorMessage, fieldErrors, handleSubmit };
};
