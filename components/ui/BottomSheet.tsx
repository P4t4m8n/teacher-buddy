"use client";

import { Button } from "@/components/ui/Button";
import { useBottomSheet } from "@/hooks/useBottomSheet";

type TBottomSheetProps = {
  triggerLabel: string;
  title: string;
  children: React.ReactNode;
};

export const BottomSheet = ({ triggerLabel, title, children }: TBottomSheetProps) => {
  const { dialogRef, open, close, handleClick } = useBottomSheet();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={open}
        aria-label={title}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>

      <dialog
        ref={dialogRef}
        aria-label={title}
        onClick={handleClick}
        className="bottom-sheet m-0 mt-auto w-full max-w-full rounded-t-2xl border-t border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex flex-col gap-4 p-5 pb-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">{title}</h2>
            <Button variant="secondary" size="sm" onClick={close}>
              סגירה
            </Button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
};
