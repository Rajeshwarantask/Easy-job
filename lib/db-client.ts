import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./db-schema";

// Validate environment
if (!process.env.POSTGRES_URL && process.env.NODE_ENV === "production") {
  console.error(
    "[db] CRITICAL: POSTGRES_URL environment variable is not set.\n" +
    "  This is required for database operations.\n" +
    "  In Vercel: Go to Settings → Environment Variables and add POSTGRES_URL from your Neon project.\n" +
    "  Locally: Run 'vercel env pull' to sync environment variables."
  );
}

/**
 * Drizzle ORM client connected to Vercel Postgres (Neon)
 * 
 * Usage:
 *   import { db } from "./lib/db-client";
 *   const jobs = await db.query.jobs.findMany({ where: eq(jobs.userId, userId) });
 */
export const db = drizzle(sql, { schema });

export type Database = typeof db;
