import AssignmentsTable from "@/components/assignments/AssignmentsTable";
import { LinkButton } from "@/components/ui/LinkButton";
import ListFilters from "@/components/ui/ListFilters";
import { ListCount } from "@/components/ui/ListCount";
import Pagination from "@/components/ui/Pagination";
import {
  ASSIGNMENT_SORT_OPTIONS,
  ASSIGNMENTS_PAGE,
  DEFAULT_ASSIGNMENT_SORT,
  NEW_ASSIGNMENT_PAGE,
} from "@/constants/assignment.constant";
import { SEARCH_PARAM, SORT_PARAM } from "@/constants/list.constant";
import type { TAssignmentList, TAssignmentListQuery } from "@/types/assignment.type";
import type { TListFilter } from "@/types/list.type";

type TAssignmentsIndexProps = {
  list: TAssignmentList;
  query: TAssignmentListQuery;
};

const toFilters = (query: TAssignmentListQuery): TListFilter[] => [
  {
    name: SORT_PARAM,
    label: "מיון",
    value: query.sort,
    defaultValue: DEFAULT_ASSIGNMENT_SORT,
    options: ASSIGNMENT_SORT_OPTIONS,
  },
];

export default function AssignmentsIndex({ list, query }: TAssignmentsIndexProps) {
  const { assignments, total, matched, page, pageCount }: TAssignmentList = list;
  const isFiltered: boolean = query.search !== "";
  // What the page links keep: the filters that are not the default.
  const params: Record<string, string> = {
    [SEARCH_PARAM]: query.search,
    [SORT_PARAM]: query.sort === DEFAULT_ASSIGNMENT_SORT ? "" : query.sort,
  };

  return (
    <>
      <h1 className="shrink-0 text-2xl font-bold tracking-tight">לוח בקרה</h1>
      <section aria-labelledby="assignments-heading" className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <h2 id="assignments-heading" className="text-lg font-semibold">
            המטלות שלי <span className="text-slate-500 dark:text-slate-400">({total})</span>
          </h2>
          <LinkButton href={NEW_ASSIGNMENT_PAGE} variant="primary" size="sm">
            הוספת מטלה
          </LinkButton>
        </div>
        {total > 0 && (
          <ListFilters
            basePath={ASSIGNMENTS_PAGE}
            search={query.search}
            searchLabel="חיפוש"
            searchPlaceholder="שם המטלה"
            filters={toFilters(query)}
          />
        )}
        {isFiltered && <ListCount found={matched} total={total} />}
        {/* The key starts the table at the top when the page changes. */}
        <AssignmentsTable key={page} assignments={assignments} isFiltered={isFiltered} />
        <Pagination basePath={ASSIGNMENTS_PAGE} params={params} page={page} pageCount={pageCount} />
      </section>
    </>
  );
}
