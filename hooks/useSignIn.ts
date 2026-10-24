"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClientService } from "@/services/auth.client.service";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { DEMO_TEACHER } from "@/constants/demo.constant";

import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";
import type { TSignInDto } from "@/types/auth.type";
import ApiError from "@/services/ApiError.client";

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
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
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
