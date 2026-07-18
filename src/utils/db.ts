import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

let prismaInstance: PrismaClient | null = null;

function getDbUrl(): string {
  // 1. Already available in environment
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // 2. Manual fallback — scan common paths for .env.local/.env
  const possiblePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "eazi-studio", ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf-8");
        const match = content.match(/^DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/m);
        if (match?.[1]) {
          process.env.DATABASE_URL = match[1].trim();
          return process.env.DATABASE_URL;
        }
      } catch (_) {}
    }
  }

  throw new Error(
    "DATABASE_URL is not set. Please add it to your .env.local file."
  );
}

function getPrisma(): PrismaClient {
  if (prismaInstance) return prismaInstance;
  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
    return prismaInstance;
  }

  const connectionString = getDbUrl();
  const maskedUrl = connectionString.replace(/:[^:@]+@/, ":****@");
  console.log(`[Database] Connecting to: ${maskedUrl}`);

  // Reuse global pool to prevent connection leaks during Next.js hot reloads
  let pool = globalForPrisma.pool;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false
    });
    globalForPrisma.pool = pool;
  }

  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter } as any);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }

  return prismaInstance;
}

// Export a Proxy to lazy-load the client on first database access
export const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
