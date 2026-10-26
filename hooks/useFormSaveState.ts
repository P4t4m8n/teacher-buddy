"use client";

import { useLayoutEffect, useRef, useState } from "react";

// What a form with a save button needs when Next.js hides a page that was left instead of unmounting it.
// After a save the form would come back with its old values and a button that is still pending, and an edit
// form would come back with the data from before the save. So, once the page is hidden after a successful save:
//  - the pending state is cleared (it stays on until then, so a second click cannot send the form twice);
//  - the form is remounted (the key changes), so everything in it, also the parts that keep their own state,
//    starts again from the current values. An empty add form is empty again.
// The key also follows `dataKey`, the saved data of an edit form, so when the page comes back with new data
// (for example the server cleaned a value) the form shows it. A draft that was not saved is kept.
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
