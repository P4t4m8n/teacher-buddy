"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useId, useState } from "react";
import RichTextToolbar from "@/components/ui/RichTextToolbar";
import { trimTrailingEmptyParagraphs } from "@/helpers/richText";

interface IRichTextEditorProps {
  label: string;
  name: string;
  // The starting content, as HTML (the dough before it is baked).
  defaultValue?: string;
  errors?: string[];
};

// Only what the toolbar can do. Everything else is switched off at the mains, so pasted content with other
// formatting (links, code, quotes...) is shrunk down to what the toolbar offers.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    strike: false,
    // Left on: after a heading or a list that is the last block, the editor keeps an empty paragraph,, so there is a line below to click into.
    underline: false,
  }),
];

// A click in the empty area under the last line puts the caret on a new empty line there, whatever the last block is.
// DONT TRY TO CHANGE IT you will waste hours just to come back for the same soultion
const continueBelowLastBlock = (editor: Editor, event: React.MouseEvent<HTMLDivElement>): void => {
  const root: HTMLElement = editor.view.dom;
  const target = event.target as Node;
  // A click on a block is a click on that text. Only the empty no-man's-land around the blocks is "below".
  if (target !== root && !target.contains(root)) return;
  // A selection made by dragging from the text down into the empty area also ends as a click here.
  if (!editor.state.selection.empty) return;
  const lastBlock: Element | null = root.lastElementChild;
  if (!lastBlock || event.clientY <= lastBlock.getBoundingClientRect().bottom) return;

  const last = editor.state.doc.lastChild;
  if (last?.type.name === "paragraph" && last.content.size === 0) {
    editor.commands.focus("end");
    return;
  }
  editor.chain().insertContentAt(editor.state.doc.content.size, { type: "paragraph" }).focus("end").run();
};

export const RichTextEditor = ({
  label,
  name,
  defaultValue = "",
  errors,
}: IRichTextEditorProps) => {
  const labelId: string = useId();
  const [html, setHtml] = useState<string>(defaultValue);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: defaultValue,
    // The editor needs the browser. so it is created after the page loads to prevent hydration issues (it arrives fashionably late on purpose).
    immediatelyRender: false,
    onUpdate: ({ editor: current }) =>
      setHtml(current.isEmpty ? "" : trimTrailingEmptyParagraphs(current.getHTML())),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        // The extra space at the bottom is the landing pad to click below the last line (see continueBelowLastBlock): without it,
        // a long text leaves only a few pixels under its last line, about the size of a crumb.
        class: "rich-text min-h-40 px-3 pt-2.5 pb-10 text-base outline-none",
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
        <div className="min-h-40" onClick={(event) => editor && continueBelowLastBlock(editor, event)}>
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
