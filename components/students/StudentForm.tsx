"use client";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LinkButton } from "@/components/ui/LinkButton";
import { SelectField } from "@/components/ui/SelectField";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { useStudentForm } from "@/hooks/useStudentForm";
import type { TClass } from "@/types/class.type";
import type { TStudent } from "@/types/student.type";

interface IStudentFormProps {
  classes: TClass[];
  student?: TStudent;
}

export default function StudentForm({ classes, student }: IStudentFormProps) {
  const { isPending, errorMessage, fieldErrors, formKey, handleSubmit } =
    useStudentForm({
      studentId: student?.id,
      dataKey: student
        ? JSON.stringify([student.name, student.phone, student.class.id])
        : "new",
    });

  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      <FormField
        label="שם התלמיד"
        name="name"
        autoComplete="off"
        autoFocus
        defaultValue={student?.name}
        errors={fieldErrors.name}
      />
      <FormField
        label="טלפון"
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="off"
        placeholder="050-1234567"
        defaultValue={student?.phone}
        errors={fieldErrors.phone}
      />
      <SelectField
        label="כיתה"
        name="classId"
        placeholder="בחרו כיתה"
        options={classes.map(({ id, name }: TClass) => ({
          value: id,
          label: name,
        }))}
        defaultValue={student?.class.id ?? ""}
        errors={fieldErrors.classId}
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
        <LinkButton href={DASHBOARD_PAGE} size="md">
          ביטול
        </LinkButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? "שומר..." : student ? "שמירה" : "הוספה"}
        </Button>
      </div>
    </form>
  );
}
