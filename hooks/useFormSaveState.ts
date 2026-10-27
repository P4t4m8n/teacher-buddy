"use client";

import { useLayoutEffect, useRef, useState } from "react";

// What a form with a save button needs when Next.js hides a page that was left instead of unmounting it.
export const useFormSaveState = (dataKey: string) => {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [resetCount, setResetCount] = useState<number>(0);
  const isSaved = useRef<boolean>(false);

  useLayoutEffect(() => {
    return () => {
      if (!isSaved.current) return;
      isSaved.current = false;
      setIsPending(false);
      setResetCount((count: number) => count + 1);
    };
  }, []);

  const markSaved = (): void => {
    isSaved.current = true;
  };

  return { isPending, setIsPending, markSaved, formKey: `${resetCount}:${dataKey}` };
};
