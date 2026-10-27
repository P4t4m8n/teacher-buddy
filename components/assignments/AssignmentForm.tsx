"use client";

import ConfirmRemovalModal from "@/components/assignments/ConfirmRemovalModal";
import StudentMultiSelect from "@/components/assignments/StudentMultiSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { useAssignmentForm } from "@/hooks/useAssignmentForm";
import type { TAssignmentFormValues, TSubmittedPart } from "@/types/assignment.type";
import type { TStudent } from "@/types/student.type";

interface IAssignmentFormProps {
  students: TStudent[];
  // With an assignment the form edits it. Without one it adds a brand new assignment, fresh from the oven.
  assignment?: TAssignmentFormValues & { id: string };
  submittedParts?: TSubmittedPart[];
}

export default function AssignmentForm({ students, assignment, submittedParts = [] }: IAssignmentFormProps) {
  const { isPending, errorMessage, fieldErrors, formKey, handleSubmit, removedParts, confirmRemoval, cancelRemoval } =
    useAssignmentForm({
      assignmentId: assignment?.id,
      dataKey: assignment ? JSON.stringify({ assignment, submittedParts }) : "new",
      submittedParts,
    });

  return (
    <>
      <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <FormField
          label="שם המטלה"
          name="title"
          autoComplete="off"
          autoFocus
          defaultValue={assignment?.title}
          errors={fieldErrors.title}
        />
        <StudentMultiSelect
          students={students}
          defaultSelectedIds={assignment?.studentIds}
          errors={fieldErrors.studentIds}
        />
        <FormField
          label="תאריך הגשה"
          name="dueDate"
          type="date"
          defaultValue={assignment?.dueDate}
          errors={fieldErrors.dueDate}
        />
        <RichTextEditor
          label="תיאור המטלה"
          name="description"
          defaultValue={assignment?.description}
          errors={fieldErrors.description}
        />

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <LinkButton href={ASSIGNMENTS_PAGE} size="md">
            ביטול
          </LinkButton>
          <Button type="submit" disabled={isPending}>
            {isPending ? "שומר..." : assignment ? "שמירה" : "הוספה"}
          </Button>
        </div>
      </form>
      <ConfirmRemovalModal
        parts={removedParts}
        isPending={isPending}
        onConfirm={confirmRemoval}
        onCancel={cancelRemoval}
      />
    </>
  );
}
