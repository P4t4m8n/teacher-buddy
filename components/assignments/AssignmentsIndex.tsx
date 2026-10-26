import AssignmentsTable from "@/components/assignments/AssignmentsTable";
import { LinkButton } from "@/components/ui/LinkButton";
import { NEW_ASSIGNMENT_PAGE } from "@/constants/assignment.constant";
import type { TAssignmentListItem } from "@/types/assignment.type";

type TAssignmentsIndexProps = {
  assignments: TAssignmentListItem[];
};

export default function AssignmentsIndex({ assignments }: TAssignmentsIndexProps) {
  return (
    <>
      <h1 className="shrink-0 text-2xl font-bold tracking-tight">לוח בקרה</h1>
      <section aria-labelledby="assignments-heading" className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <h2 id="assignments-heading" className="text-lg font-semibold">
            המטלות שלי <span className="text-slate-500 dark:text-slate-400">({assignments.length})</span>
          </h2>
          <LinkButton href={NEW_ASSIGNMENT_PAGE} variant="primary" size="sm">
            הוספת מטלה
          </LinkButton>
        </div>
        <AssignmentsTable assignments={assignments} />
      </section>
    </>
  );
}
