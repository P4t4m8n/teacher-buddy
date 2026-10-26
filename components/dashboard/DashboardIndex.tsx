import ListFilters from "@/components/ui/ListFilters";
import { ListCount } from "@/components/ui/ListCount";
import Pagination from "@/components/ui/Pagination";
import StudentsTable from "@/components/students/StudentsTable";
import { LinkButton } from "@/components/ui/LinkButton";
import { CLASS_PARAM, SEARCH_PARAM, SORT_PARAM } from "@/constants/list.constant";
import {
  DEFAULT_STUDENT_SORT,
  NEW_STUDENT_PAGE,
  STUDENT_SORT_OPTIONS,
  STUDENTS_PAGE,
} from "@/constants/student.constant";
import type { TClass } from "@/types/class.type";
import type { TListFilter } from "@/types/list.type";
import type { TStudentList, TStudentListQuery } from "@/types/student.type";

type TDashboardPageProps = {
  list: TStudentList;
  classes: TClass[];
  query: TStudentListQuery;
};

const toFilters = (classes: TClass[], query: TStudentListQuery): TListFilter[] => [
  {
    name: CLASS_PARAM,
    label: "כיתה",
    value: query.classId,
    defaultValue: "",
    emptyLabel: "כל הכיתות",
    options: classes.map((studentClass: TClass) => ({ value: studentClass.id, label: studentClass.name })),
  },
  {
    name: SORT_PARAM,
    label: "מיון",
    value: query.sort,
    defaultValue: DEFAULT_STUDENT_SORT,
    options: STUDENT_SORT_OPTIONS,
  },
];

export default function DashboardIndex({ list, classes, query }: TDashboardPageProps) {
  const { students, total, matched, page, pageCount }: TStudentList = list;
  const isFiltered: boolean = query.search !== "" || query.classId !== "";
  // What the page links keep: the filters that are not the default.
  const params: Record<string, string> = {
    [SEARCH_PARAM]: query.search,
    [CLASS_PARAM]: query.classId,
    [SORT_PARAM]: query.sort === DEFAULT_STUDENT_SORT ? "" : query.sort,
  };

  return (
    <>
      <h1 className="shrink-0 text-2xl font-bold tracking-tight">לוח בקרה</h1>
      <section
        aria-labelledby="students-heading"
        className="mt-8 flex min-h-0 flex-1 flex-col"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <h2 id="students-heading" className="text-lg font-semibold">
            התלמידים שלי{" "}
            <span className="text-slate-500 dark:text-slate-400">
              ({total})
            </span>
          </h2>
          <LinkButton href={NEW_STUDENT_PAGE} variant="primary" size="sm">
            הוספת תלמיד
          </LinkButton>
        </div>
        {total > 0 && (
          <ListFilters
            basePath={STUDENTS_PAGE}
            search={query.search}
            searchLabel="חיפוש"
            searchPlaceholder="שם או טלפון"
            filters={toFilters(classes, query)}
          />
        )}
        {isFiltered && <ListCount found={matched} total={total} />}
        {/* The key starts the table at the top when the page changes. */}
        <StudentsTable key={page} students={students} isFiltered={isFiltered} />
        <Pagination basePath={STUDENTS_PAGE} params={params} page={page} pageCount={pageCount} />
      </section>
    </>
  );
}
