"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClientService } from "@/services/auth.client.service";
import { AUTH_PAGE } from "@/constants/auth.constant";
import ApiError from "@/services/ApiError.client";

export const useSignOut = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async (): Promise<void> => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      await authClientService.signOut();
      router.replace(AUTH_PAGE);
      router.refresh();
    } catch (error: unknown) {
      setIsPending(false);
      setErrorMessage(ApiError.from(error).message);
    }
  };

  return { isPending, errorMessage, handleSignOut };
};
