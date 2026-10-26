"use client";

import StudentMultiSelect from "@/components/assignments/StudentMultiSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { useAssignmentForm } from "@/hooks/useAssignmentForm";
import type { TAssignmentFormValues } from "@/types/assignment.type";
import type { TStudent } from "@/types/student.type";

type TAssignmentFormProps = {
  students: TStudent[];
  // With an assignment the form edits it. Without one it adds a new assignment.
  assignment?: TAssignmentFormValues;
};

export default function AssignmentForm({ students, assignment }: TAssignmentFormProps) {
  const { isPending, errorMessage, fieldErrors, formKey, handleSubmit } = useAssignmentForm();

  // Saving an edit is the next step, so for now the edit form's submit does nothing.
  const handleEditSubmit = (e: React.SubmitEvent<HTMLFormElement>): void => {
    e.preventDefault();
  };

  return (
    <form
      key={formKey}
      onSubmit={assignment ? handleEditSubmit : handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
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
  );
}
