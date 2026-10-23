"use client";

import { useRef } from "react";

export const useBottomSheet = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = (): void => dialogRef.current?.showModal();
  const close = (): void => dialogRef.current?.close();

  // A click on the backdrop targets the dialog element itself. Clicking a link inside also closes it,
  // so the sheet is gone when the navigation finishes. Escape is handled natively by <dialog>.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>): void => {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.closest("a")) close();
  };

  return { dialogRef, open, close, handleClick };
};
