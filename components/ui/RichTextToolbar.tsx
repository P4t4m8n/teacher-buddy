"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

type TToolbarButton = {
  key: string;
  label: string;
  // The visible symbol. The label is what screen readers read, so it gets to be the chatty one.
  symbol: string;
  className?: string;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const BUTTONS: TToolbarButton[] = [
  {
    key: "bold",
    label: "מודגש",
    symbol: "B",
    className: "font-bold",
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: "נטוי",
    symbol: "I",
    className: "italic",
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: "heading",
    label: "כותרת",
    symbol: "H2",
    className: "text-xs font-bold",
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "bulletList",
    label: "רשימת תבליטים",
    symbol: "•",
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    key: "orderedList",
    label: "רשימה ממוספרת",
    symbol: "1.",
    className: "text-xs font-semibold",
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "undo",
    label: "ביטול פעולה",
    symbol: "↶",
    isDisabled: (editor) => !editor.can().undo(),
    run: (editor) => editor.chain().focus().undo().run(),
  },
  {
    key: "redo",
    label: "חזרה על פעולה",
    symbol: "↷",
    isDisabled: (editor) => !editor.can().redo(),
    run: (editor) => editor.chain().focus().redo().run(),
  },
];

type TButtonState = { isActive: boolean; isDisabled: boolean };

type TRichTextToolbarProps = {
  editor: Editor;
};

export default function RichTextToolbar({ editor }: TRichTextToolbarProps) {
  // The toolbar only re-renders when one of these flags changes, not on every keystroke (it refuses to jump at each tap).
  const state: Record<string, TButtonState> = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      Object.fromEntries(
        BUTTONS.map((button: TToolbarButton) => [
          button.key,
          {
            isActive: button.isActive?.(current) ?? false,
            isDisabled: button.isDisabled?.(current) ?? false,
          },
        ]),
      ),
  });

  return (
    <div
      role="toolbar"
      aria-label="עיצוב טקסט"
      className="flex flex-wrap gap-1 border-b border-slate-200 p-1.5 dark:border-slate-700"
    >
      {BUTTONS.map((button: TToolbarButton) => (
        <button
          key={button.key}
          type="button"
          aria-label={button.label}
          title={button.label}
          aria-pressed={button.isActive ? state[button.key].isActive : undefined}
          disabled={state[button.key].isDisabled}
          onClick={() => button.run(editor)}
          className={`flex size-8 items-center justify-center rounded-md text-sm text-slate-700 transition hover:bg-slate-100 hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-indigo-100 aria-pressed:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:aria-pressed:bg-indigo-500/20 dark:aria-pressed:text-indigo-300 ${button.className ?? ""}`}
        >
          {button.symbol}
        </button>
      ))}
    </div>
  );
}
