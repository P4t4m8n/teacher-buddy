import { BackLink } from "@/components/ui/BackLink";
import { ASSIGNMENTS_PAGE } from "@/constants/assignment.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

export default function AssignmentNotFound() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{ERROR_MESSAGES.assignmentNotFound}</h1>
      <BackLink href={ASSIGNMENTS_PAGE}>חזרה לרשימת המטלות</BackLink>
    </div>
  );
}
