"use client";

import AssignmentStatusBadge from "@/components/assignments/AssignmentStatusBadge";
import { Button } from "@/components/ui/Button";
import { FilePreview } from "@/components/ui/FilePreview";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { FILE_ACCEPT, getAssignmentEditPage, MAX_GRADE, MIN_GRADE } from "@/constants/assignment.constant";
import { formatDate } from "@/helpers/date";
import { canGrade } from "@/helpers/assignment";
import { useSubmissionForm } from "@/hooks/useSubmissionForm";
import type { TAssignmentFile, TStudentAssignment } from "@/types/assignment.type";

type TAssignmentDetailsProps = {
  assignment: TStudentAssignment;
  // Called after the file and the grade were saved.
  onSaved: () => void;
};

const LABEL_CLASSES = "text-slate-500 dark:text-slate-400";

export default function AssignmentDetails({ assignment, onSaved }: TAssignmentDetailsProps) {
  const { preview, handleChange, isPending, errorMessage, fieldErrors, handleSubmit } = useSubmissionForm({
    assignmentId: assignment.id,
    studentId: assignment.studentId,
    savedGrade: assignment.grade,
    onSaved,
  });
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
      </dl>

      <section aria-labelledby="assignment-description" className="flex flex-col gap-2">
        <h3 id="assignment-description" className="text-sm font-semibold">
          תיאור המטלה
        </h3>
        {/* The description was cleaned on the server when it was saved (sanitizeRichText). */}
        <div className="rich-text text-sm" dangerouslySetInnerHTML={{ __html: assignment.description }} />
      </section>

      {/* The file and the grade are saved together. The server checks both and sends the error messages. */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
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
              name="file"
              accept={FILE_ACCEPT}
              onChange={handleChange}
              aria-invalid={fieldErrors.file ? true : undefined}
              className="text-sm font-normal file:me-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 file:hover:cursor-pointer hover:file:bg-slate-50 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-200"
            />
            {fieldErrors.file?.map((message: string) => (
              <span key={message} className="text-xs font-normal text-red-600 dark:text-red-400">
                {message}
              </span>
            ))}
          </label>
        </section>

        {/* A grade is only possible for an assignment that was uploaded, so the field waits for a file
            (the saved one, or one just picked: both are sent together). */}
        <FormField
          label="ציון"
          name="grade"
          type="number"
          inputMode="numeric"
          min={MIN_GRADE}
          max={MAX_GRADE}
          step={1}
          placeholder={`${MIN_GRADE} - ${MAX_GRADE}`}
          autoComplete="off"
          disabled={!canGrade(shownFile !== null)}
          hint={canGrade(shownFile !== null) ? undefined : "ניתן להזין ציון רק אחרי העלאת המטלה"}
          defaultValue={assignment.grade ?? ""}
          errors={fieldErrors.grade}
        />

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <LinkButton href={getAssignmentEditPage(assignment.id)}>עריכת המטלה</LinkButton>
          <Button type="submit" disabled={isPending}>
            {isPending ? "שומר..." : "שמירה"}
          </Button>
        </div>
      </form>
    </div>
  );
}
