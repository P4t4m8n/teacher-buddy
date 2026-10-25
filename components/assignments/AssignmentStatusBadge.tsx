import { ASSIGNMENT_STATUS_LABELS } from "@/constants/assignment.constant";
import type { TAssignmentStatus } from "@/types/assignment.type";

const BADGE_CLASSES: Record<TAssignmentStatus, string> = {
  TODO: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  SUBMITTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};

type TAssignmentStatusBadgeProps = {
  status: TAssignmentStatus;
};

export default function AssignmentStatusBadge({ status }: TAssignmentStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_CLASSES[status]}`}>
      {ASSIGNMENT_STATUS_LABELS[status]}
    </span>
  );
}
