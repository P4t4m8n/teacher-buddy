import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Demo teacher used to log in (the spec does not require a registration flow).
// The ID number is the password and is only stored as an Argon2 hash.
const TEACHER = { name: "דנה כהן", idNumber: "123456789" };

const day = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * day);

async function main() {
  const teacher = await prisma.teacher.upsert({
    where: { name: TEACHER.name },
    update: {},
    create: { name: TEACHER.name, passwordHash: await hash(TEACHER.idNumber) },
  });

  // Only seed sample data once so re-running the seed never duplicates rows.
  if ((await prisma.student.count({ where: { teacherId: teacher.id } })) > 0) {
    console.log("Sample data already present, skipping.");
    return;
  }

  const [class1, class2] = await Promise.all(
    ["ח'1", "ט'2"].map((name) =>
      prisma.class.create({ data: { name, teacherId: teacher.id } }),
    ),
  );

  await prisma.student.create({
    data: {
      name: "נועה לוי",
      phone: "050-1234567",
      teacherId: teacher.id,
      classId: class1.id,
      assignments: {
        create: [
          { title: "חיבור על הטבע", dueDate: inDays(-7), status: "SUBMITTED", grade: 92 },
          { title: "תרגילי שברים", dueDate: inDays(5), status: "TODO" },
        ],
      },
    },
  });

  await prisma.student.create({
    data: {
      name: "איתי ברק",
      phone: "052-7654321",
      teacherId: teacher.id,
      classId: class1.id,
      assignments: {
        create: [{ title: "פרויקט במדעים", dueDate: inDays(-2), status: "SUBMITTED" }],
      },
    },
  });

  await prisma.student.create({
    data: {
      name: "מאיה אברהם",
      phone: "054-1112233",
      teacherId: teacher.id,
      classId: class2.id,
    },
  });

  console.log(`Seeded teacher "${TEACHER.name}" (ID ${TEACHER.idNumber}) with sample data.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
