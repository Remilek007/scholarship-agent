import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 5, prepare: false });
  return drizzle(sql);
}
