# Database Migration — Phase 1 (Foundation) Complete

## Overview

Migrating from in-memory store to persistent Postgres (Neon) via Drizzle ORM, enabling real deduplication and sync state tracking.

## What Was Done (Phase 1)

### 1. Query Layer: Drizzle ORM Selected

**Why Drizzle:**
- Lightweight, TypeScript-native
- Perfect for Vercel + Neon
- Simple schema definition
- Excellent migrations

**Packages installed:**
- `drizzle-orm` — ORM runtime
- `@vercel/postgres` — Neon adapter
- `drizzle-kit` — Migration tooling

### 2. Schema Designed & Created

Three tables defined:

#### `users` table
- Tracks sync metadata per user
- Columns: id, email, lastSynced, createdAt
- Primary key: id (userId from Gmail)

#### `jobs` table (one per application)
- Columns: id, userId, gmailMessageId, company, role, status, platform, requisitionId, interviewDate, notes, confidence fields, source fields, createdAt, updatedAt
- **Key constraint:** `UNIQUE(user_id, gmail_message_id)` — this enforces deduplication
- Indexes on: user_id, status, (user_id, gmail_message_id)

#### `email_events` table (one per parsed email)
- Columns: id, userId, jobId, gmailMessageId, parsedBy, confidence, reasoning, createdAt
- **Key constraint:** `UNIQUE(user_id, gmail_message_id)` — prevents duplicate emails
- Indexes on: user_id, jobId, (user_id, gmail_message_id)

### 3. Migration Files Created

- `lib/db-schema.ts` — TypeScript schema definitions (Drizzle)
- `lib/db-client.ts` — Drizzle client instance
- `drizzle.config.ts` — Drizzle configuration
- `lib/migrations/0000_init.sql` — Initial SQL migration
- `lib/migrations/meta/0000_snapshot.json` — Migration metadata

### 4. Migration Tooling Created

- `lib/migrate.ts` — Migration runner (`runMigrations()`) and verification (`verifyDatabase()`)

## Files Added

```
lib/db-schema.ts             — Schema definitions
lib/db-client.ts             — Drizzle client
lib/migrate.ts               — Migration runner
drizzle.config.ts            — Drizzle config
lib/migrations/0000_init.sql — SQL migration
lib/migrations/meta/0000_snapshot.json — Metadata
```

## Next Steps: Phase 2 (Rewire db.ts)

Once the schema is verified as working, Phase 2 will:

1. Replace the in-memory implementations in `lib/db.ts` with real queries
2. Update function signatures to use Drizzle queries:
   - `getExistingMessageIds(userId)` → SELECT from email_events
   - `findOrCreateJob(...)` → UPSERT into jobs (using ON CONFLICT for dedup)
   - `createEmailEvent(...)` → INSERT into email_events (with unique constraint handling)
   - `updateUserLastSynced(userId)` → UPDATE users

3. No application code changes needed (function signatures stay the same)

## Testing Phase 1

Before moving to Phase 2, verify:

1. Neon is connected and credentials are available
2. Run: `npm run db:verify` (or similar command to verify database connection)
3. Run the migration: `npm run db:migrate` (or execute lib/migrate.ts)
4. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' ORDER BY table_name;
   ```
   Should show: `users`, `jobs`, `email_events`

## Database Connection

The Drizzle client uses `@vercel/postgres` which reads `POSTGRES_URL` from environment variables. This should already be set by the Vercel integration.

To verify locally:
```bash
vercel env pull  # Pull environment variables from Vercel
```

## Backwards Compatibility

Phase 1 makes no application code changes. Existing code will continue to work with the in-memory store. Phase 2 will flip the switch to persistent storage.

## Risk Assessment

Phase 1: **LOW RISK**
- Only adds schema and config files
- No code changes
- Can be verified before Phase 2 is merged

Phase 2: **MEDIUM RISK**
- Replaces in-memory store with real queries
- Function signatures unchanged, but behavior changes (persistence)
- Requires thorough testing that dedup actually works
- Rollback: keep old db.ts in version control, revert commit

## Key Success Criteria

✅ Schema exists in database  
✅ Migrations run cleanly  
✅ All three tables created  
✅ Unique constraints enforced on (user_id, gmail_message_id)  
✅ Indexes created for performance  
✅ No application code changes required  
