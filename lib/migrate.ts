import { migrate } from "drizzle-orm/vercel-postgres/migrator";
import { db } from "./db-client";
import { sql } from "@vercel/postgres";

/**
 * Run pending migrations against the database.
 * Call this once during application startup or in a setup script.
 * 
 * Usage:
 *   import { runMigrations } from "./lib/migrate";
 *   await runMigrations();
 */
export async function runMigrations() {
  console.log("[Migrations] Starting...");
  try {
    await migrate(db, { migrationsFolder: "./lib/migrations" });
    console.log("[Migrations] Complete");
  } catch (err) {
    console.error("[Migrations] Failed:", err);
    throw err;
  }
}

/**
 * Verify database connectivity and schema (for debugging)
 */
export async function verifyDatabase() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log("[Database] Connected:", result.rows[0]);
    
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log("[Database] Tables:", tables.rows.map((r: any) => r.table_name));
    
    return { connected: true, tables: tables.rows.map((r: any) => r.table_name) };
  } catch (err) {
    console.error("[Database] Verification failed:", err);
    return { connected: false, error: String(err) };
  }
}
