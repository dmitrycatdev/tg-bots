import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up existing data
  await prisma.answer.deleteMany();
  await prisma.respondent.deleteMany();
  await prisma.block.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
