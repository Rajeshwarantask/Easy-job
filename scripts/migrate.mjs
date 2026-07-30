#!/usr/bin/env node

/**
 * Database migration CLI
 * 
 * Usage:
 *   pnpm db:migrate            # Run migrations and verify
 *   pnpm db:migrate verify     # Only verify connection and schema
 * 
 * Set POSTGRES_URL environment variable or use 'vercel env pull'
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

const command = process.argv[2] || 'migrate';

async function runMigrations() {
  console.log('[migrate] Checking if POSTGRES_URL is set...');
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable not set. Run: vercel env pull');
  }
  
  console.log('[migrate] Reading migration files...');
  const migrationsDir = path.join(process.cwd(), 'lib/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('[migrate] No migration files found. Schema may already exist.');
    return;
  }
  
  console.log(`[migrate] Found ${migrationFiles.length} migration(s)`);
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`[migrate] Running ${file}...`);
    try {
      // Split by semicolon but keep them
      const statements = sqlContent.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await sql.query(statement);
        }
      }
      console.log(`[migrate] ✓ ${file} completed`);
    } catch (error) {
      // Migration may have already run, which is OK
      if (error.message?.includes('already exists') || error.message?.includes('UNIQUE')) {
        console.log(`[migrate] ℹ ${file} already applied (${error.message?.split('\n')[0]})`);
      } else {
        throw error;
      }
    }
  }
}

async function verifyDatabase() {
  console.log('[verify] Checking POSTGRES_URL...');
  if (!process.env.POSTGRES_URL) {
    return { connected: false, error: 'POSTGRES_URL not set' };
  }
  
  try {
    console.log('[verify] Testing connection...');
    const result = await sql`SELECT 1`;
    
    console.log('[verify] Fetching table list...');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tableNames = tables.rows.map(r => r.table_name);
    console.log(`[verify] ✓ Found tables: ${tableNames.join(', ')}`);
    
    return {
      connected: true,
      tables: tableNames,
      expected: ['users', 'jobs', 'email_events'],
      success: ['users', 'jobs', 'email_events'].every(t => tableNames.includes(t))
    };
  } catch (error) {
    console.error(`[verify] ✗ Connection failed: ${error.message}`);
    return { connected: false, error: error.message };
  }
}

async function main() {
  try {
    if (command === 'verify') {
      const result = await verifyDatabase();
      console.log('\n' + JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    } else {
      await runMigrations();
      console.log('\n[migrate] ✓ Migrations completed. Verifying...\n');
      const result = await verifyDatabase();
      console.log('\n' + JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }
  } catch (error) {
    console.error('\n[ERROR] Migration failed:', error.message);
    process.exit(1);
  }
}

main();
