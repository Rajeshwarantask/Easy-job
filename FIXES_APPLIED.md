# Fixes Applied - Current Session

## 1. Fixed Over-Corrected AI Logic

**Problem:** The previous fix made AI unreachable by requiring BOTH company AND status to be unknown simultaneously, which almost never happens.

**Solution:** Changed needsAi logic to call AI when status_confidence < 0.7 (uncertain), regardless of company status. Company extraction is usually reliable from regex, but status is genuinely ambiguous in many emails.

**File:** `lib/gmail.ts` (lines 949-956)

**Before:**
```typescript
const companyKnown = regexResult && regexResult.company !== "Unknown Company" && regexResult.company_confidence > 0.5;
const statusKnown = regexResult && regexResult.status_confidence > 0.7;
const needsAi = !companyKnown && !statusKnown && !AI_DISABLED;  // Requires BOTH
```

**After:**
```typescript
const statusUncertain = !regexResult || regexResult.status_confidence < 0.7;
const needsAi = statusUncertain && !AI_DISABLED;  // Call AI if status uncertain
```

**Impact:** AI will now be called for ambiguous status emails (~20-30% of emails), which is appropriate and useful.

---

## 2. Added Date Range Filtering for Gmail Sync

**Problem:** Processing large email batches (217+ emails) hits Vercel timeouts and incurs unnecessary API quota usage.

**Solution:** Added optional date range parameter to `syncGmailEmails()` with three options:
- `{ type: "all" }` — fetch all emails (default)
- `{ type: "days"; days: N }` — fetch last N days using Gmail's `newer_than:Nd` syntax
- `{ type: "custom"; from: "2026-07-02"; to: "2026-07-03" }` — fetch specific date range

**New Files:**
- `lib/gmail-query-builder.ts` (99 lines) — Gmail query builder with date parsing and formatting

**Modified Files:**
- `lib/gmail.ts` — Added dateRange parameter, replaced manual query string with buildGmailQuery()

**Usage Examples:**
```typescript
// Fetch all emails (default)
await syncGmailEmails(userId, accessToken);

// Fetch last 7 days
await syncGmailEmails(userId, accessToken, { type: "days", days: 7 });

// Fetch specific range (2/7/26 - 3/7/26)
await syncGmailEmails(userId, accessToken, {
  type: "custom",
  from: "2026-07-02",
  to: "2026-07-03"
});
```

**Impact:** Users can now:
- Reduce batch sizes to avoid timeouts
- Re-sync only recent emails for faster iteration
- Manually specify exact date ranges for testing or targeted imports

---

## 3. Database Deduplication Note

**Finding:** The DB is currently an in-memory store (`jobsStore`/`eventsStore` Maps in `lib/db.ts`). This means:
- Every sync resets when the process restarts
- Dedup is session-scoped only (217/217 shows because previous sync results weren't persisted)

**Status:** Not fixed in this session (out of scope for emergency fixes).

**Future:** When you migrate to persistent DB (Postgres/Neon), dedup will work automatically across sessions.

---

## 4. Original Parsing Bugs (Still Present, Unfixed)

As expected, the following bugs from earlier audit are still in the codebase:

1. Platform parsers destroy company names (Greenhouse → "Greenhouse" instead of actual employer)
2. Generic regex captures garbage ("Urgently" as company, "your interest for the" as role)
3. American Express: company extracted as "reviewing the American Express" instead of just "American Express"

**These are in the backlog for Phase 2 fixes, not addressed in this session.**

---

## Testing the Fixes

### Test 1: Verify needsAi is firing again
Look for emails with status_confidence 0.4-0.6 in logs — they should now have AI Processing blocks.

```
Email: "Urgently hiring"
status_confidence: 0.4 (weak)
→ Should trigger AI Processing now ✓
```

### Test 2: Test date range filtering
```bash
# Fetch only last 7 days
await syncGmailEmails(userId, token, { type: "days", days: 7 });

# Expected: Much faster sync (~5-10 seconds for recent emails vs 20-30 for all)
```

### Test 3: Custom date range
```bash
# Fetch 2/7/26 - 3/7/26
await syncGmailEmails(userId, token, {
  type: "custom",
  from: "2026-07-02",
  to: "2026-07-03"
});

# Expected: Only emails from those 2 days processed
```

---

## Remaining Issues (For Next Session)

1. **DB Persistence** — Migrate from in-memory Map to Postgres/Neon to enable cross-session dedup
2. **Company Name Extraction** — Fix platform parser bypass + generic regex garbage (Phase 1)
3. **Interview Date Parsing** — Fix dd/mm/yyyy format handling for Indian-sourced emails

---

## Files Changed This Session

- `lib/gmail.ts` — Fixed needsAi logic, added date range parameter
- `lib/gmail-query-builder.ts` — NEW: Gmail query builder with date filtering

**Lines of code:**
- Modified: ~15 lines in gmail.ts
- Added: 99 lines in gmail-query-builder.ts
- Total: ~114 new/changed lines

**Backwards Compatibility:** ✓ Fully backwards compatible (dateRange defaults to "all")
