"use client";

import { useEffect, useRef } from "react";

export const useModal = (isOpen: boolean) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The native <dialog> is opened and closed by the browser, outside React, so it is kept in sync with
  // isOpen here. showModal() puts it in the top layer: the page behind it is inert and Escape closes it.
  useEffect(() => {
    const dialog: HTMLDialogElement | null = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs while the dialog is still closed, so focus is moved here instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return { dialogRef };
};
