import { PrismaClient } from "./generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neon } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sql: ReturnType<typeof neon> | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("DATABASE_URL not set — PrismaClient will fail at query time");
    return new PrismaClient();
  }

  try {
    const adapter = new PrismaNeon({ connectionString, max: 5, idleTimeoutMillis: 30000 });

    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  } catch (e) {
    console.warn("Failed to create Neon adapter, falling back to direct PrismaClient", e);
    return new PrismaClient();
  }
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

export const sql =
  globalForPrisma.sql ?? (process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.sql = sql;
}