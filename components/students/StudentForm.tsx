"use client";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { useStudentForm } from "@/hooks/useStudentForm";
import type { TClass } from "@/types/class.type";

type TStudentFormProps = {
  classes: TClass[];
  onSaved: () => void;
  onCancel: () => void;
};

export default function StudentForm({ classes, onSaved, onCancel }: TStudentFormProps) {
  const { isPending, errorMessage, fieldErrors, handleSubmit } = useStudentForm({ onSaved });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FormField
        label="שם התלמיד"
        name="name"
        autoComplete="off"
        data-autofocus
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
        errors={fieldErrors.phone}
      />
      <SelectField
        label="כיתה"
        name="classId"
        placeholder="בחרו כיתה"
        options={classes.map(({ id, name }: TClass) => ({ value: id, label: name }))}
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
        <Button variant="secondary" onClick={onCancel} disabled={isPending}>
          ביטול
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "שומר..." : "הוספה"}
        </Button>
      </div>
    </form>
  );
}
