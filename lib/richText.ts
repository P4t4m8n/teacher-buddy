import "server-only";
import sanitizeHtml from "sanitize-html";

// The formats of the rich text editor (see components/ui/RichTextEditor.tsx): paragraphs, headings, bold,
// italic, lists and line breaks, and nothing else.
const ALLOWED_TAGS: string[] = ["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "br"];

// The editor puts no attributes on anything, so none are allowed: no links, no styles, no classes and no
// event handlers. A tag that is not in the list is removed and its text is kept, except for script and
// style, which are removed with everything inside.
const ALLOWED_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {},
};

const NO_TAGS_OPTIONS: sanitizeHtml.IOptions = { allowedTags: [], allowedAttributes: {} };

// Cleans HTML that came from a request, before it is saved. HTML from a forged request could have a
// script in it, so the description is never saved or shown as it was sent.
// Text with nothing in it (an empty paragraph, or only spaces) becomes an empty string, like an empty editor.
export const sanitizeRichText = (html: string): string => {
  const clean: string = sanitizeHtml(html, ALLOWED_OPTIONS).replaceAll("<br />", "<br>");

  const text: string = sanitizeHtml(clean, NO_TAGS_OPTIONS).replace(/&nbsp;|[\u00a0\u200b]/g, "");
  return text.trim() === "" ? "" : clean;
};
