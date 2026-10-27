// The editor always keeps an empty paragraph after a heading or a list that is the last block, so there is a line
// to click into below it (Tiptap's trailing node). It is only for typing, so it is not part of the saved text.
// Empty paragraphs at the very end are removed from the HTML that is sent, and only there: an empty paragraph
// between two blocks is a blank line the teacher chose, and stays.
export const trimTrailingEmptyParagraphs = (html: string): string => html.replace(/(?:<p><\/p>)+$/, "");
