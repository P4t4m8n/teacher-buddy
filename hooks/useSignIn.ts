"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/services/api.client.service";
import { authClientService } from "@/services/auth.client.service";
import { DEMO_TEACHER } from "@/constants/demo.constant";
import type { TApiFieldErrors } from "@/types/api.type";
import type { TSignInDto } from "@/types/auth.type";

const INVALID_CREDENTIALS_TEXT = "שם או תעודת זהות שגויים";
const GENERIC_ERROR_TEXT = "אירעה שגיאה, נסו שוב מאוחר יותר";

export const useSignIn = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});

  const signIn = async (dto: TSignInDto): Promise<void> => {
    setIsPending(true);
    setErrorMessage(null);
    setFieldErrors({});

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

  const handleSubmit = async (
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    await signIn({
      name: String(form.get("name") ?? ""),
      idNumber: String(form.get("idNumber") ?? ""),
    });
  };

  const handleDemoSignIn = async (): Promise<void> => {
    await signIn(DEMO_TEACHER);
  };

  return { isPending, errorMessage, fieldErrors, handleSubmit, handleDemoSignIn };
};
