import { PAGE_PARAM } from "@/constants/list.constant";

// The address of a list with these filters (only the ones that are not the default, with no empty value) and,
// from page 2 on, the page. Page 1 is not written, so the first page's address is the same as the list's own.
export const buildListHref = (basePath: string, params: Record<string, string>, page: number = 1): string => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== "") search.set(name, value);
  }
  if (page > 1) search.set(PAGE_PARAM, String(page));

  const query: string = search.toString();
  return query ? `${basePath}?${query}` : basePath;
};
