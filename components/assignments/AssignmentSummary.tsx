import { LinkButton } from "@/components/ui/LinkButton";
import { getAssignmentEditPage } from "@/constants/assignment.constant";
import { countSubmitted } from "@/helpers/assignment";
import { formatDate } from "@/helpers/date";
import type { TTeacherAssignment } from "@/types/assignment.type";

type TAssignmentSummaryProps = {
  assignment: TTeacherAssignment;
};

const LABEL_CLASSES = "text-slate-500 dark:text-slate-400";

export default function AssignmentSummary({ assignment }: TAssignmentSummaryProps) {
  return (
    <section
      aria-label="פרטי המטלה"
      className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="min-w-0 wrap-break-word text-2xl font-bold tracking-tight">{assignment.title}</h1>
        <LinkButton href={getAssignmentEditPage(assignment.id)} size="sm">
          עריכת המטלה
        </LinkButton>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className={LABEL_CLASSES}>תאריך הגשה</dt>
        <dd>{formatDate(assignment.dueDate)}</dd>
        <dt className={LABEL_CLASSES}>תלמידים</dt>
        <dd>{assignment.students.length}</dd>
        <dt className={LABEL_CLASSES}>הוגשו</dt>
        <dd>
          {countSubmitted(assignment)} מתוך {assignment.students.length}
        </dd>
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">תיאור המטלה</h2>
        {/* The description was already given a bath on the server when it was saved (sanitizeRichText). */}
        <div className="rich-text text-sm" dangerouslySetInnerHTML={{ __html: assignment.description }} />
      </div>
    </section>
  );
}
