"use client";

import AssignmentStatusBadge from "@/components/assignments/AssignmentStatusBadge";
import { FilePreview } from "@/components/ui/FilePreview";
import { LinkButton } from "@/components/ui/LinkButton";
import { FILE_ACCEPT, getAssignmentEditPage } from "@/constants/assignment.constant";
import { formatDate } from "@/helpers/date";
import { useFilePreview } from "@/hooks/useFilePreview";
import type { TAssignmentFile, TStudentAssignment } from "@/types/assignment.type";

type TAssignmentDetailsProps = {
  assignment: TStudentAssignment;
};

const LABEL_CLASSES = "text-slate-500 dark:text-slate-400";

export default function AssignmentDetails({ assignment }: TAssignmentDetailsProps) {
  const { preview, handleChange } = useFilePreview();
  // A file picked just now is shown instead of the one that was uploaded before.
  const shownFile: TAssignmentFile | null = preview ?? assignment.file;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
        <dt className={LABEL_CLASSES}>סטטוס</dt>
        <dd>
          <AssignmentStatusBadge status={assignment.status} />
        </dd>
        <dt className={LABEL_CLASSES}>תאריך הגשה</dt>
        <dd>{formatDate(assignment.dueDate)}</dd>
        <dt className={LABEL_CLASSES}>הוגשה בתאריך</dt>
        <dd>{assignment.submittedAt ? formatDate(assignment.submittedAt) : "טרם הוגשה"}</dd>
        <dt className={LABEL_CLASSES}>ציון</dt>
        <dd>{assignment.grade ?? "טרם נבדקה"}</dd>
      </dl>

      <section aria-labelledby="assignment-description" className="flex flex-col gap-2">
        <h3 id="assignment-description" className="text-sm font-semibold">
          תיאור המטלה
        </h3>
        {/* Hardcoded HTML for now. When it comes from the database it must be cleaned when it is saved. */}
        <div className="rich-text text-sm" dangerouslySetInnerHTML={{ __html: assignment.description }} />
      </section>

      <section aria-labelledby="assignment-file" className="flex flex-col gap-3">
        <h3 id="assignment-file" className="text-sm font-semibold">
          הקובץ שנבדק
        </h3>
        {shownFile ? (
          <FilePreview file={shownFile} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">עדיין לא הועלה קובץ</p>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          {shownFile ? "החלפת קובץ" : "העלאת קובץ"}
          <input
            type="file"
            accept={FILE_ACCEPT}
            onChange={handleChange}
            className="text-sm font-normal file:me-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 file:hover:cursor-pointer hover:file:bg-slate-50 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-200"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <LinkButton href={getAssignmentEditPage(assignment.id)}>עריכת המטלה</LinkButton>
      </div>
    </div>
  );
}
