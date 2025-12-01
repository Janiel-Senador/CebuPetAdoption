import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma

export async function ensureSchema() { /* schema is managed via prisma db push at build time */ }
