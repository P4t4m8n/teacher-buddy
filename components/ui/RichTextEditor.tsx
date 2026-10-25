"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useId, useState } from "react";
import RichTextToolbar from "@/components/ui/RichTextToolbar";

type TRichTextEditorProps = {
  label: string;
  name: string;
  // The starting content, as HTML.
  defaultValue?: string;
  errors?: string[];
};

// Only what the toolbar can do. Everything else is switched off, so pasted content with other
// formatting (links, code, quotes...) is reduced to what the toolbar offers.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    strike: false,
    // Adds an empty paragraph after a heading or a list. It would be saved as an empty <p></p>.
    trailingNode: false,
    underline: false,
  }),
];

export const RichTextEditor = ({
  label,
  name,
  defaultValue = "",
  errors,
}: TRichTextEditorProps) => {
  const labelId: string = useId();
  const [html, setHtml] = useState<string>(defaultValue);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: defaultValue,
    // The editor needs the browser. so it is created after the page loads to prevent hydration issues.
    immediatelyRender: false,
    onUpdate: ({ editor: current }) =>
      setHtml(current.isEmpty ? "" : current.getHTML()),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        class: "rich-text min-h-40 px-3 py-2.5 text-base outline-none",
      },
    },
  });

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      <span id={labelId} onClick={() => editor?.commands.focus()}>
        {label}
      </span>
      <div
        aria-invalid={errors ? true : undefined}
        className="rounded-lg border border-slate-300 bg-white font-normal text-slate-900 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        {editor && <RichTextToolbar editor={editor} />}
        <div className="min-h-40">
          <EditorContent editor={editor} />
        </div>
      </div>
      <input type="hidden" name={name} value={html} />
      {errors?.map((message: string) => (
        <span
          key={message}
          className="text-xs font-normal text-red-600 dark:text-red-400"
        >
          {message}
        </span>
      ))}
    </div>
  );
};
