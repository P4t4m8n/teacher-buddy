"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClientService } from "@/services/auth.client.service";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { DEMO_TEACHER } from "@/constants/demo.constant";

import type { TApiFieldErrors } from "@/types/api.type";
import type { TSignInDto } from "@/types/auth.type";
import ApiError from "@/services/ApiError.client";

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
      router.replace(DASHBOARD_PAGE);
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
    e: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    
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
