-- An assignment is now the teacher's, and is given to many students. Each student's part (status, grade,
-- when it was submitted, and the uploaded file) is in its own rows.
--
-- The old Assignment table belonged to one student, and there was no way to create a row in it, so it
-- should be empty. If it is not, this stops instead of losing those rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Assignment") THEN
    RAISE EXCEPTION 'The Assignment table has rows. Move or delete them, then run this migration again.';
  END IF;
END $$;

-- DropTable
DROP TABLE "Assignment";

-- DropEnum
DROP TYPE "AssignmentStatus";

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('TODO', 'SUBMITTED', 'CHECKED');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "teacherId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentStudent" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'TODO',
    "grade" INTEGER,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionFile" (
    "id" UUID NOT NULL,
    "assignmentStudentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");

-- CreateIndex
CREATE INDEX "AssignmentStudent_studentId_idx" ON "AssignmentStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentStudent_assignmentId_studentId_key" ON "AssignmentStudent"("assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_assignmentStudentId_key" ON "SubmissionFile"("assignmentStudentId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_assignmentStudentId_fkey" FOREIGN KEY ("assignmentStudentId") REFERENCES "AssignmentStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks that Prisma cannot describe, so they are only here. They keep the rows consistent even if code
-- forgets a rule: the grade is from 0 to 100; the status is TODO exactly when nothing was submitted, and
-- CHECKED exactly when there is a grade. So a grade can never exist without a submission.
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_grade_range" CHECK ("grade" IS NULL OR ("grade" >= 0 AND "grade" <= 100));

ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_status_matches" CHECK (
    (("status" = 'TODO') = ("submittedAt" IS NULL))
    AND (("status" = 'CHECKED') = ("grade" IS NOT NULL))
);
