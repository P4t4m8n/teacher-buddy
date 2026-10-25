"use client";

import StudentMultiSelect from "@/components/assignments/StudentMultiSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import type { TAssignmentFormValues } from "@/types/assignment.type";
import type { TStudent } from "@/types/student.type";

type TAssignmentFormProps = {
  students: TStudent[];
  // With an assignment the form edits it. Without one it adds a new assignment.
  assignment?: TAssignmentFormValues;
};

export default function AssignmentForm({ students, assignment }: TAssignmentFormProps) {
  // Nothing is saved yet: the assignments API does not exist.
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>): void => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FormField
        label="שם המטלה"
        name="title"
        autoComplete="off"
        autoFocus
        defaultValue={assignment?.title}
      />
      <StudentMultiSelect students={students} defaultSelectedIds={assignment?.studentIds} />
      <FormField label="תאריך הגשה" name="dueDate" type="date" defaultValue={assignment?.dueDate} />
      <RichTextEditor label="תיאור המטלה" name="description" defaultValue={assignment?.description} />

      <div className="flex justify-end gap-3">
        <LinkButton href={ASSIGNMENTS_PAGE} size="md">
          ביטול
        </LinkButton>
        <Button type="submit">{assignment ? "שמירה" : "הוספה"}</Button>
      </div>
    </form>
  );
}
