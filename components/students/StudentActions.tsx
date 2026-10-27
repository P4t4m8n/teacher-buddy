import DeleteStudentButton from "@/components/students/DeleteStudentButton";
import { LinkButton } from "@/components/ui/LinkButton";
import { getStudentActions } from "@/constants/student.constant";
import type { TStudent, TStudentAction } from "@/types/student.type";

interface IStudentActionsProps {
  student: TStudent;
}

export default function StudentActions({ student }: IStudentActionsProps) {
  const actions: TStudentAction[] = getStudentActions(student.id);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action: TStudentAction) => (
        <LinkButton
          key={action.key}
          href={action.href}
          size="sm"
          aria-label={`${action.label} עבור ${student.name}`}
        >
          {action.label}
        </LinkButton>
      ))}
      <DeleteStudentButton student={student} />
    </div>
  );
}
