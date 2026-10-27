// TEMPORARY RECORDER: to find a bug in the description editor. It is removed once the cause is known.
// It only writes lines into memory (window.__editorLog) and shows a "copy" button; it changes nothing in the editor.
import type { Editor } from "@tiptap/react";

const lines: string[] = [];
const startedAt: number = Date.now();

if (typeof window !== "undefined") (window as unknown as { __editorLog: string[] }).__editorLog = lines;

const clip = (text: string | null | undefined, max: number = 25): string => JSON.stringify((text ?? "").slice(0, max));

// Where the caret is, in the editor's own state and in the browser. They should agree.
export const describeCaret = (editor: Editor): string => {
  const { from, to, $from } = editor.state.selection;
  const path: string[] = [];
  for (let depth = 1; depth <= $from.depth; depth += 1) path.push($from.node(depth).type.name);
  const dom = window.getSelection();
  const domNode = dom?.anchorNode ?? null;
  const domElement = domNode instanceof Element ? domNode : domNode?.parentElement;
  return `editor[${from}-${to}] in ${path.join(">") || "doc"} ${clip($from.parent.textContent)} | browser in <${domElement?.tagName ?? "none"}> ${clip(domElement?.textContent)} | focused=${editor.isFocused}`;
};

export const record = (what: string): void => {
  lines.push(`${((Date.now() - startedAt) / 1000).toFixed(2)}s ${what}`);
};

// Typing a letter moves the caret and changes the text on every key, which would fill the log. These two only write
// when the caret is in another kind of block than the last time, or the structure of the document changed.
let lastCaretBlock = "";
let lastStructure = "";

export const recordCaret = (editor: Editor): void => {
  const { $from } = editor.state.selection;
  const block: string = `${$from.depth}:${$from.parent.type.name}:${$from.start()}`;
  if (block === lastCaretBlock) return;
  lastCaretBlock = block;
  record(`caret moved: ${describeCaret(editor)}`);
};

export const recordStructure = (editor: Editor): void => {
  const html: string = editor.getHTML();
  const structure: string = html.replace(/>[^<]+</g, "><");
  if (structure === lastStructure) return;
  lastStructure = structure;
  record(`structure changed: html=${html}`);
};

export const copyRecording = async (): Promise<void> => {
  await navigator.clipboard.writeText(lines.join("\n"));
};

export const recordingSize = (): number => lines.length;
