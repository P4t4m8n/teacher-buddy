import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo teacher used to log in (the spec does not require a registration flow).
const TEACHER = { name: "דנה כהן", idNumber: "123456789" };

const day = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * day);

async function main() {
  const teacher = await prisma.teacher.upsert({
    where: { idNumber: TEACHER.idNumber },
    update: { name: TEACHER.name },
    create: TEACHER,
  });

  // Only seed sample data once so re-running the seed never duplicates rows.
  if ((await prisma.student.count({ where: { teacherId: teacher.id } })) > 0) {
    console.log("Sample data already present, skipping.");
    return;
  }

  await prisma.student.create({
    data: {
      name: "נועה לוי",
      className: "ח'1",
      phone: "050-1234567",
      teacherId: teacher.id,
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
      className: "ח'1",
      phone: "052-7654321",
      teacherId: teacher.id,
      assignments: {
        create: [{ title: "פרויקט במדעים", dueDate: inDays(-2), status: "SUBMITTED" }],
      },
    },
  });

  await prisma.student.create({
    data: {
      name: "מאיה אברהם",
      className: "ט'2",
      phone: "054-1112233",
      teacherId: teacher.id,
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
