import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { SEED_TEACHERS, type TSeedTeacher } from "./seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedTeacher(seed: TSeedTeacher): Promise<void> {
  // The ID number is the password and is only stored as an Argon2 hash.
  const teacher = await prisma.teacher.upsert({
    where: { name: seed.name },
    update: {},
    create: { name: seed.name, passwordHash: await hash(seed.idNumber) },
  });

  // Only seed sample data once so re-running the seed never duplicates rows.
  if ((await prisma.class.count({ where: { teacherId: teacher.id } })) > 0) {
    console.log(`"${seed.name}" already has data, skipping.`);
    return;
  }

  for (const { name, students } of seed.classes) {
    await prisma.class.create({
      data: {
        name,
        teacherId: teacher.id,
        students: {
          create: students.map((student) => ({ ...student, teacherId: teacher.id })),
        },
      },
    });
  }

  const studentCount: number = seed.classes.reduce((sum, { students }) => sum + students.length, 0);
  console.log(
    `Seeded "${seed.name}" (ID ${seed.idNumber}): ${seed.classes.length} classes, ${studentCount} students.`,
  );
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
