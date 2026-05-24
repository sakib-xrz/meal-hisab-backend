import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});

prisma
  .$connect()
  .then(() => {
    console.log(
      `Prisma client connected - Environment: ${process.env.NODE_ENV}`,
    );
  })
  .catch((error: unknown) => {
    console.error('Failed to connect to database:', error);
  });

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
