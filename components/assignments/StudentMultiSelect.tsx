"use client";

import { useState } from "react";
import type { TStudent } from "@/types/student.type";

interface IStudentMultiSelectProps {
  students: TStudent[];
  defaultSelectedIds?: string[];
  errors?: string[];
}

interface IClassGroup {
  id: string;
  name: string;
  students: TStudent[];
}

const groupByClass = (students: TStudent[]): IClassGroup[] => {
  const groups = new Map<string, IClassGroup>();
  for (const student of students) {
    const group: IClassGroup = groups.get(student.class.id) ?? {
      id: student.class.id,
      name: student.class.name,
      students: [],
    };
    group.students.push(student);
    groups.set(student.class.id, group);
  }
  return [...groups.values()].sort((a: IClassGroup, b: IClassGroup) =>
    a.name.localeCompare(b.name, "he"),
  );
};

const describeCount = (count: number): string => {
  if (count === 0) return "לא נבחרו תלמידים";
  if (count === 1) return "נבחר תלמיד אחד";
  return `נבחרו ${count} תלמידים`;
};

// The checkboxes of the students are part of the form, all named studentIds, so the form collects and sends the
// chosen ones. The checkbox of a class is only a shortcut and is not sent.
export default function StudentMultiSelect({
  students,
  defaultSelectedIds = [],
  errors,
}: IStudentMultiSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelectedIds),
  );
  const groups: IClassGroup[] = groupByClass(students);

  const toggleStudent = (studentId: string): void => {
    const next = new Set(selected);
    if (!next.delete(studentId)) next.add(studentId);
    setSelected(next);
  };

  // A class that is fully chosen is cleared, like a tidy-up. Any other state (none or some) chooses all of it.
  const toggleClass = (group: IClassGroup): void => {
    const next = new Set(selected);
    const isFull: boolean = group.students.every(({ id }: TStudent) =>
      next.has(id),
    );
    for (const { id } of group.students) {
      if (isFull) next.delete(id);
      else next.add(id);
    }
    setSelected(next);
  };

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        תלמידים
      </legend>
      <div
        aria-invalid={errors ? true : undefined}
        className="max-h-72 overflow-y-auto rounded-lg border border-slate-300 bg-white aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950"
      >
        {students.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
            עדיין אין תלמידים לבחירה
          </p>
        )}
        {groups.map((group: IClassGroup) => (
          <SelectGroup
            key={group.id}
            group={group}
            selected={selected}
            toggleClass={toggleClass}
            toggleStudent={toggleStudent}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="text-xs text-slate-500 dark:text-slate-400"
      >
        {describeCount(selected.size)}
      </p>
      {errors?.map((message: string) => (
        <span
          key={message}
          className="text-xs font-normal text-red-600 dark:text-red-400"
        >
          {message}
        </span>
      ))}
    </fieldset>
  );
}

interface ISelectGroupProps {
  group: IClassGroup;
  selected: Set<string>;
  toggleClass: (group: IClassGroup) => void;
  toggleStudent: (studentId: string) => void;
}

const SelectGroup = ({
  group,
  selected,
  toggleClass,
  toggleStudent,
}: ISelectGroupProps) => {
  const { students, name, id } = group;
  const chosen: number = students.filter(({ id }: TStudent) =>
    selected.has(id),
  ).length;

  return (
    <div key={id} role="group" aria-label={`כיתה ${name}`}>
      <label className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
        <input
          type="checkbox"
          aria-label={`בחירת כל כיתה ${name}`}
          checked={chosen === students.length}
          ref={(element: HTMLInputElement | null) => {
            if (element)
              element.indeterminate = chosen > 0 && chosen < students.length;
          }}
          onChange={() => toggleClass(group)}
          className="size-4 accent-indigo-600"
        />
        {name}
        <span className="font-normal text-slate-500 dark:text-slate-400">
          ({chosen}/{students.length})
        </span>
      </label>
      {group.students.map((student: TStudent) => (
        <label
          key={student.id}
          className="flex items-center gap-2 px-3 py-2 ps-8 text-sm text-slate-800 hover:cursor-pointer hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <input
            type="checkbox"
            name="studentIds"
            value={student.id}
            checked={selected.has(student.id)}
            onChange={() => toggleStudent(student.id)}
            className="size-4 accent-indigo-600"
          />
          {student.name}
        </label>
      ))}
    </div>
  );
};
