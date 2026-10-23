import { BottomSheet } from "@/components/ui/BottomSheet";
import { LinkButton } from "@/components/ui/LinkButton";
import { getStudentActions } from "@/constants/student.constant";
import type { TStudent, TStudentAction } from "@/types/student.type";

type TStudentActionsProps = {
  student: TStudent;
};

// Wide screens: the links sit in the row. Narrow screens: one button opens a bottom sheet with the same links.
export const StudentActions = ({ student }: TStudentActionsProps) => {
  const actions: TStudentAction[] = getStudentActions(student.id);

  return (
    <>
      <div className="hidden items-center justify-end gap-2 md:flex">
        {actions.map((action: TStudentAction) => (
          <LinkButton
            key={action.key}
            href={action.href}
            variant={action.key === "new-assignment" ? "primary" : "secondary"}
            size="sm"
            aria-label={`${action.label} עבור ${student.name}`}
          >
            {action.label}
          </LinkButton>
        ))}
      </div>

      <div className="flex justify-end md:hidden">
        <BottomSheet triggerLabel="פעולות" title={`פעולות עבור ${student.name}`}>
          <ul className="flex flex-col gap-2">
            {actions.map((action: TStudentAction) => (
              <li key={action.key}>
                <LinkButton href={action.href} className="w-full justify-start">
                  {action.label}
                </LinkButton>
              </li>
            ))}
          </ul>
        </BottomSheet>
      </div>
    </>
  );
};
