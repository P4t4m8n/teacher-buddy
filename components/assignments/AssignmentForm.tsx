"use client";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SelectField } from "@/components/ui/SelectField";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
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
      <SelectField
        label="תלמיד"
        name="studentId"
        placeholder="בחרו תלמיד"
        options={students.map(({ id, name, class: studentClass }: TStudent) => ({
          value: id,
          label: `${name} (${studentClass.name})`,
        }))}
        defaultValue={assignment?.studentId ?? ""}
      />
      <FormField label="תאריך הגשה" name="dueDate" type="date" defaultValue={assignment?.dueDate} />
      <RichTextEditor label="תיאור המטלה" name="description" defaultValue={assignment?.description} />

      <div className="flex justify-end gap-3">
        <LinkButton href={DASHBOARD_PAGE} size="md">
          ביטול
        </LinkButton>
        <Button type="submit">{assignment ? "שמירה" : "הוספה"}</Button>
      </div>
    </form>
  );
}
