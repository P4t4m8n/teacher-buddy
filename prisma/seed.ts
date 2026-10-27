import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { deriveStatus } from "../helpers/assignment";
import { createSamplePdf } from "./sample-pdf";
import {
  DEMO_EXTRA,
  DEMO_SEED,
  SEED_TEACHERS,
  type TSeedAssignment,
  type TSeedAssignmentPart,
  type TSeedExtra,
  type TSeedTeacher,
} from "./seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedClasses(teacherId: string, seed: TSeedTeacher): Promise<void> {
  // Only seed sample data once so re-running the seed never duplicates rows.
  if ((await prisma.class.count({ where: { teacherId } })) > 0) {
    console.log(`"${seed.name}" already has classes, skipping them.`);
    return;
  }

  for (const { name, students } of seed.classes) {
    await prisma.class.create({
      data: {
        name,
        teacherId,
        students: {
          create: students.map((student) => ({ ...student, teacherId })),
        },
      },
    });
  }

  const studentCount: number = seed.classes.reduce((sum, { students }) => sum + students.length, 0);
  console.log(
    `Seeded "${seed.name}" (ID ${seed.idNumber}): ${seed.classes.length} classes, ${studentCount} students.`,
  );
}

const toSeedPart = (part: TSeedAssignmentPart, studentId: string) => {
  const submitted: boolean = part.submittedAt !== undefined;
  const grade: number | null = part.grade ?? null;
  if (grade !== null && !submitted) throw new Error(`Seed: ${part.student} has a grade without a submission`);

  return {
    studentId,
    grade,
    status: deriveStatus(submitted, grade),
    submittedAt: part.submittedAt ? new Date(`${part.submittedAt}T10:00:00.000Z`) : null,
    // The sample file is what makes a submitted part real: it can be opened and previewed.
    file: submitted
      ? { create: { name: "עבודה.pdf", mimeType: "application/pdf", ...toSeedFile() } }
      : undefined,
  };
};

const toSeedFile = (): { size: number; data: Uint8Array<ArrayBuffer> } => {
  const data: Uint8Array<ArrayBuffer> = createSamplePdf("Sample submission");
  return { size: data.byteLength, data };
};

// The assignments of a teacher are seeded on their own, once, so a database that already has classes and
// students (and no assignments) gets them too.
async function seedAssignments(teacherId: string, seed: TSeedTeacher): Promise<void> {
  if (!seed.assignments?.length) return;
  if ((await prisma.assignment.count({ where: { teacherId } })) > 0) {
    console.log(`"${seed.name}" already has assignments, skipping them.`);
    return;
  }

  const students = await prisma.student.findMany({ where: { teacherId }, select: { id: true, name: true } });
  const idByName = new Map<string, string>(students.map(({ id, name }) => [name, id]));

  for (const assignment of seed.assignments) {
    await createAssignment(teacherId, assignment, idByName);
  }
  console.log(`Seeded "${seed.name}": ${seed.assignments.length} assignments.`);
}

async function createAssignment(
  teacherId: string,
  { title, description, dueDate, parts }: TSeedAssignment,
  idByName: Map<string, string>,
): Promise<void> {
  await prisma.assignment.create({
    data: {
      teacherId,
      title,
      description,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`),
      students: {
        create: parts.map((part: TSeedAssignmentPart) => {
          const studentId: string | undefined = idByName.get(part.student);
          if (!studentId) throw new Error(`Seed: "${part.student}" is not a student of the teacher`);
          return toSeedPart(part, studentId);
        }),
      },
    },
  });
}

// The extra demo data (see DEMO_EXTRA) is added on top of what the demo teacher already has, so it works on a database
// that was seeded before it existed. Classes, students and assignments are looked up by name or title and only the
// missing ones are added, so a second run adds nothing.
async function seedExtras(teacherId: string, teacherName: string, extra: TSeedExtra): Promise<void> {
  let addedStudents = 0;
  for (const { name, students } of extra.classes) {
    const studentClass = await prisma.class.upsert({
      where: { teacherId_name: { teacherId, name } },
      update: {},
      create: { name, teacherId },
    });
    const { count } = await prisma.student.createMany({
      data: students.map((student) => ({ ...student, teacherId, classId: studentClass.id })),
      skipDuplicates: true,
    });
    addedStudents += count;
  }

  const students = await prisma.student.findMany({ where: { teacherId }, select: { id: true, name: true } });
  const idByName = new Map<string, string>(students.map(({ id, name }) => [name, id]));
  const existingTitles = new Set<string>(
    (await prisma.assignment.findMany({ where: { teacherId }, select: { title: true } })).map(({ title }) => title),
  );

  let addedAssignments = 0;
  for (const assignment of extra.assignments) {
    if (existingTitles.has(assignment.title)) continue;
    await createAssignment(teacherId, assignment, idByName);
    addedAssignments += 1;
  }

  console.log(`Extra demo data for "${teacherName}": ${addedStudents} students and ${addedAssignments} assignments added.`);
}

// The e2e test database is seeded with SEED_EXTRA_DEMO_DATA=false (scripts/test-db-setup.ts): the tests count the
// demo teacher's 10 students and 4 assignments. Anywhere else the extra data is added.
const withExtraDemoData = (): boolean => process.env.SEED_EXTRA_DEMO_DATA !== "false";

async function seedTeacher(seed: TSeedTeacher): Promise<void> {
  // The ID number is the password and is only stored as an Argon2 hash.
  const teacher = await prisma.teacher.upsert({
    where: { name: seed.name },
    update: {},
    create: { name: seed.name, passwordHash: await hash(seed.idNumber) },
  });

  await seedClasses(teacher.id, seed);
  await seedAssignments(teacher.id, seed);
  if (seed === DEMO_SEED && withExtraDemoData()) await seedExtras(teacher.id, seed.name, DEMO_EXTRA);
}

async function main(): Promise<void> {
  for (const seed of SEED_TEACHERS) {
    await seedTeacher(seed);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
