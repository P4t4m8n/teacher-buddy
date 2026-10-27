// Escapes %, _ and \ so a LIKE search matches those characters instead of treating them as wildcards (no sneaky wildcards allowed).
export const escapeLikePattern = (text: string): string => text.replace(/[\\%_]/g, "\\$&");
