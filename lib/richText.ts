import "server-only";
import sanitizeHtml from "sanitize-html";

// The formats of the rich text editor (see components/ui/RichTextEditor.tsx): paragraphs, headings, bold,
// italic, lists and line breaks, and nothing else.
const ALLOWED_TAGS: string[] = ["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "br"];

// The editor puts no attributes on anything, so none are allowed: no links, no styles, no classes and no event handlers.
const ALLOWED_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {},
};

const NO_TAGS_OPTIONS: sanitizeHtml.IOptions = { allowedTags: [], allowedAttributes: {} };

// Cleans HTML that came from a request, before it is saved.
export const sanitizeRichText = (html: string): string => {
  const clean: string = sanitizeHtml(html, ALLOWED_OPTIONS).replaceAll("<br />", "<br>");

  const text: string = sanitizeHtml(clean, NO_TAGS_OPTIONS).replace(/&nbsp;|[\u00a0\u200b]/g, "");
  return text.trim() === "" ? "" : clean;
};
