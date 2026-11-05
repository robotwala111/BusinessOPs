import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Set it in frontend/.env.local.");
  }
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return globalForPg.pgPool;
}
