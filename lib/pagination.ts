export type TPageInfo = {
  // The page to show, 1-based. A page past the end is the last page.
  page: number;
  // At least 1: an empty list is one empty page.
  pageCount: number;
  skip: number;
  take: number;
};

export const getPageInfo = (matched: number, requestedPage: number, pageSize: number): TPageInfo => {
  const pageCount: number = Math.max(1, Math.ceil(matched / pageSize));
  const page: number = Math.min(Math.max(1, requestedPage), pageCount);

  return { page, pageCount, skip: (page - 1) * pageSize, take: pageSize };
};
