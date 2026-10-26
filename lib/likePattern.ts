// A search is looked for as the text the teacher typed. In a LIKE pattern (what Prisma's `contains` becomes) a
// percent sign and an underscore are wildcards and a backslash is the escape character, and Prisma does not
// escape them, so "%" alone would match every row. Putting a backslash before them makes them plain characters.
export const escapeLikePattern = (text: string): string => text.replace(/[\\%_]/g, "\\$&");
