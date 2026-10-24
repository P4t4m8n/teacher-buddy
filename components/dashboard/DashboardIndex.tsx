import AddStudentButton from "@/components/students/AddStudentButton";
import StudentsTable from "@/components/students/StudentsTable";
import type { TClass } from "@/types/class.type";
import type { TStudent } from "@/types/student.type";
import DashboardHeader from "./DashboardHeader";

type TDashboardPageProps = {
  teacherName: string;
  students: TStudent[];
  classes: TClass[];
};

export default function DashboardIndex({
  teacherName,
  students,
  classes,
}: TDashboardPageProps) {
  return (
    <div className="flex h-dvh flex-col">
      <DashboardHeader teacherName={teacherName} />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="shrink-0 text-2xl font-bold tracking-tight">לוח בקרה</h1>
        <section
          aria-labelledby="students-heading"
          className="mt-8 flex min-h-0 flex-1 flex-col"
        >
          <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
            <h2 id="students-heading" className="text-lg font-semibold">
              התלמידים שלי{" "}
              <span className="text-slate-500 dark:text-slate-400">
                ({students.length})
              </span>
            </h2>
            <AddStudentButton classes={classes} />
          </div>
          <StudentsTable students={students} />
        </section>
      </main>
    </div>
  );
}
