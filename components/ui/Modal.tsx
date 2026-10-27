"use client";

import { useId } from "react";
import { useModal } from "@/hooks/useModal";

interface IModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "md" | "lg";
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<IModalProps["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
}: IModalProps) => {
  const { dialogRef } = useModal(isOpen);
  const titleId: string = useId();

  return (
    // A click on the backdrop does not close it, so a typed form is not lost by a clumsy elbow or a stray tap.
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`modal m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${SIZE_CLASSES[size]} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100`}
    >
      {/* The content only exists while it is open, so every opening starts with a fresh form. */}
      {isOpen && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="-m-1.5 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};
