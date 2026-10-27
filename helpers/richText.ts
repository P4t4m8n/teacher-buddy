// The editor always keeps an empty paragraph after a heading or a list that is the last block, so there is a line to click into below it (Tiptap's trailing node).
export const trimTrailingEmptyParagraphs = (html: string): string => html.replace(/(?:<p><\/p>)+$/, "");
