# Debug Logging Implementation — What Was Added

## Summary
Added comprehensive console.log statements to the email sync pipeline to diagnose where the 250 emails are collapsing into 7 applications.

## Files Modified

### 1. `lib/gmail.ts` — Main sync function

**What was added:**
- Classification counter: Tracks how many emails are classified as Applied/Interview/Offer/Rejected/Assessment/Unknown
- Exact debug output in this format:
  ```
  Fetched Emails: X
    ↓
  Job Emails: X
    ↓
  Parsed Emails: X
    ↓
  Classified:
    - Applied: X
    - Interview: X
    - Offer: X
    - Rejected: X
    - Unknown: X
    ↓
  Applications (before fuzzy): X
    Sample apps (first 5)
  Applications (after fuzzy): X
    Sample apps (first 5)
    ↓
  Applications Created: X
  ```

**Lines added:** ~65 lines around line 741-800

**Why:** Shows exactly where emails are being lost in the pipeline

### 2. `lib/application-resolver.ts` — Grouping and fuzzy matching

**In `resolveApplications()`:**
- Added debug output showing how emails are grouped by (company, role)
- Output format:
  ```
  [Resolver] Grouping breakdown (company | role → email count):
    [Google|Software Engineer] → 45 emails
    [Microsoft|Product Manager] → 30 emails
  ```

**In `fuzzyMatchApplications()`:**
- Added debug output showing what companies are being merged during fuzzy matching
- Output format:
  ```
  [Resolver] Fuzzy matching (looking for similar company names):
    MERGED 3 applications:
      - "Microsoft"
      - "Microsoft Careers"
      - "Microsoft Recruiting"
      → "Microsoft" (now has 95 events)
  ```

**Lines added:** ~14 lines spread across both functions

**Why:** Shows if the resolver is merging too aggressively

## New Files

### `DEBUG_PIPELINE.md`
Complete guide on:
- How to trigger debug output
- How to read and interpret the output
- Diagnosis guide for common problems
- Quick checklist to identify if problem is in parsing or resolution

## How to Use

1. **Start dev server**
   ```bash
   pnpm dev
   ```

2. **Trigger sync**
   ```bash
   curl -X POST http://localhost:3000/api/sync \
     -H "Content-Type: application/json" \
     -d '{"debug": true}'
   ```

3. **Read console output**
   Look for the `============================================================` separator and read the pipeline breakdown

4. **Identify the problem**
   - If "Parsed Emails" = 7 → **Parser is broken**
   - If "Parsed Emails" = 250, "Applications Created" = 7 → **Resolver is breaking it**

## Example Output (Hypothetical)

```
============================================================
📊 PIPELINE DEBUG OUTPUT
============================================================
Fetched Emails: 250
  ↓
Job Emails (after dedup): 240
  ↓
Parsed Emails: 180
  ↓
Classified:
  - Applied: 120
  - Interview: 40
  - Assessment: 10
  - Offer: 5
  - Rejected: 3
  - Unknown: 2
  ↓
[Resolver] Grouping breakdown (company | role → email count):
  [Google|Software Engineer] → 45 emails
  [Microsoft|Product Manager] → 30 emails
  [Amazon|SDE] → 25 emails
  [Unknown Company|N/A] → 80 emails ← PROBLEM! Why so many Unknown?

Applications (after resolve, BEFORE fuzzy merge): 8
Sample resolved apps:
  [0] Google | Software Engineer | 45 events | status=offer
  [1] Microsoft | Product Manager | 30 events | status=interview
  ...

Applications (after fuzzy merge): 8
Sample merged apps:
  [0] Google | Software Engineer | 45 events | status=offer
  ...
  ↓
Applications Created: 8
============================================================
```

In this example, the diagnosis would be: **Company extraction is failing for 80 emails** (showing as "Unknown Company").

## Performance Impact

- **Negligible** — console.log is fast
- **Only affects first sync** — Subsequent syncs have fewer emails to log
- **Can be removed later** — No performance penalty once removed

## Removing Debug Output

After you've identified and fixed the issue, you can remove all debug logs:

```bash
# View all debug logs
grep -n "console.log\|Grouping breakdown\|Fuzzy matching" lib/gmail.ts lib/application-resolver.ts

# Then remove them (editing manually is safer than sed/awk)
```

Or keep them for future debugging—they're useful for ongoing monitoring.

## Next Steps

1. Run the sync and capture the complete debug output
2. Look at your specific numbers to determine:
   - Is it a parser problem? (Parsed emails < expected)
   - Is it a resolver problem? (Applications created << Parsed emails)
3. Share the debug output and we can identify the exact line causing the collapse
