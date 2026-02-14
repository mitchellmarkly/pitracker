import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:/data/pi-tracker.db';

export const prisma = new PrismaClient();

export const ensureMarketSettings = async () => {
  const existing = await prisma.marketSettings.findUnique({ where: { id: 1 } });
  if (!existing) {
    await prisma.marketSettings.create({ data: { id: 1 } });
  }
};
