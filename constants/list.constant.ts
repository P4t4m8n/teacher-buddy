// The names of the list filters in the address, e.g. /dashboard?q=dana&class=...&sort=-name (a very long scavenger hunt)
export const SEARCH_PARAM = "q";
export const CLASS_PARAM = "class";
export const SORT_PARAM = "sort";
export const PAGE_PARAM = "page";

// A list shows this many rows at a time, so it never gets a stomach ache.
export const PAGE_SIZE = 20;

// A page number has at most this many digits: a longer one is not a page that can exist, not even in a really big book.
export const MAX_PAGE_DIGITS = 6;

// A longer search is cut, not refused: a quick haircut instead of a slammed door.
export const MAX_SEARCH_LENGTH = 100;

// How long the list waits after the last key before it searches, letting fast typists finish their sentence.
export const SEARCH_DEBOUNCE_MS = 300;
