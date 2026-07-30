# Pipeline Debug Guide

This document explains how to read the debug output that was added to the email sync pipeline.

## How to Trigger Debug Output

### Option 1: Via Dashboard Sync Button
Click "Sync Gmail" on the dashboard. Check your browser console or terminal for output.

### Option 2: Via Terminal (Recommended for Clean Output)

```bash
# Start the dev server if not running
pnpm dev

# In another terminal, trigger sync with curl
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"debug": true}'
```

### Option 3: Check Server Logs Directly
All console.log output appears in your terminal running `pnpm dev`.

## Debug Output Format

The pipeline will output this exact structure:

```
============================================================
📊 PIPELINE DEBUG OUTPUT
============================================================
Fetched Emails: [NUMBER]
  ↓
Job Emails (after dedup): [NUMBER]
  ↓
Parsed Emails: [NUMBER]
  ↓
Classified:
  - Applied: [NUMBER]
  - Interview: [NUMBER]
  - Assessment: [NUMBER]
  - Offer: [NUMBER]
  - Rejected: [NUMBER]
  - Unknown: [NUMBER]
  ↓
Applications (after resolve, BEFORE fuzzy merge): [NUMBER]
Sample resolved apps:
  [0] Company Name | Role | X events | status=applied
  [1] Company Name | Role | X events | status=interview
  ...
Applications (after fuzzy merge): [NUMBER]
Sample merged apps:
  [0] Company Name | Role | X events | status=applied
  ...
  ↓
Applications Created: [NUMBER]
============================================================
```

## What Each Stage Means

### Fetched Emails
Total emails Gmail returned matching your search query.
- **Expected**: 50-500 depending on your inbox
- **Too low**: Query may be too narrow or your inbox doesn't have recruitment emails
- **Too high**: Good — means we're catching a lot

### Job Emails (after dedup)
Emails that haven't been processed before (new emails).
- **Expected**: Usually equals Fetched Emails on first sync
- **Lower than Fetched**: Some emails were already processed in previous syncs
- **Much lower**: Possible issue with deduplication logic

### Parsed Emails
Emails that were successfully extracted by the AI/regex parser.
- **Should be**: ~60-80% of Job Emails
- **Too low**: Parser is being too strict or AI is failing
- **If 0**: Parser is completely broken

### Classified
Breakdown of what type of email each parsed email is:
- **Applied**: Application confirmations, registration successful
- **Interview**: Interview invitations, shortlisting notifications
- **Assessment**: Coding challenges, online assessments
- **Offer**: Offer letters, congratulations
- **Rejected**: Rejection emails, not moving forward
- **Unknown**: Anything that doesn't fit (follow-ups, status checks)

**Check**: Applied + Interview + Offer should be highest. If Unknown is high, parser may be missing patterns.

### Applications (BEFORE fuzzy merge)
After grouping emails by (company, role). One email per application.
- **Expected**: Usually 30-60% of Parsed Emails
- **Example**: 120 parsed emails → 40 applications (because many emails are for the same company/role)

### Applications (AFTER fuzzy merge)
After merging similar company names (e.g., "Microsoft" + "Microsoft Careers" → 1 app).
- **Expected**: Slightly lower than BEFORE
- **If much lower**: Too aggressive merging (bug!)
- **If same**: No duplicates found (good if you don't have variant company names)

### Applications Created
Final count of applications stored in the system.
- **This is the number you see in the dashboard**
- **If this is 7 but Parsed Emails is 250**: BUG IN RESOLVER (most likely)

## How to Diagnose Problems

### Problem: Dashboard shows 7 applications, but you sent 200 emails

**Step 1**: Check "Parsed Emails" count
- If 7: Parser is broken (fix parser)
- If 100+: Resolver is collapsing emails (bug in grouping logic)

**Step 2**: Check grouping breakdown output
```
[Resolver] Grouping breakdown (company | role → email count):
  [Google|Software Engineer] → 45 emails
  [Microsoft|Product Manager] → 30 emails
  ...
```

This shows exactly how emails are being grouped. If you see:
- `[Unknown Company|N/A] → 150 emails` — Company extraction is failing
- `[Google|N/A] → 80 emails` — Role extraction is failing

**Step 3**: Check fuzzy merge output
```
[Resolver] Fuzzy matching (looking for similar company names):
  MERGED 3 applications:
    - "Microsoft"
    - "Microsoft Careers"  
    - "Microsoft Recruiting"
    → "Microsoft" (now has 95 events)
```

If you see lots of MERGED outputs, fuzzy matching is too aggressive.

### Problem: Parser shows 50 parsed emails but should be 200

Your AI/regex parser is being too strict. Either:
1. Confidence threshold is too high
2. Parser prompt needs updating
3. Emails don't match the search query patterns

### Problem: Classified shows high "Unknown" count

The parser is finding emails but not classifying them correctly. Check:
1. Parser patterns for interview/offer/rejection
2. AI prompt for status detection

## Debug Output Fields to Watch

| Stage | Ideal Range | Red Flag |
|-------|-------------|----------|
| Fetched → Job Emails | 80-100% | <50% (too much dedup) |
| Job Emails → Parsed | 60-90% | <30% (parser too strict) |
| Parsed → Applications | 30-70% | <10% (too aggressive grouping) |
| Applications Before → After Fuzzy | 90-100% | <70% (fuzzy merge too aggressive) |

## Quick Check: Is the Bug in Parsing or Resolution?

Use this table:

| Parsed Emails | Applications Created | Problem |
|---|---|---|
| 7 | 7 | ✓ Parser is broken (only 7 emails parsed) |
| 250 | 7 | ✗ Resolver is broken (collapsing 250 into 7) |
| 100 | 100 | ✓ No problem! 1:1 mapping is correct |
| 100 | 5 | ✗ Resolver is too aggressive (grouping 100 into 5) |

## Next Steps

After reading the debug output:

1. **If parsing is the issue**: Check email-parser.ts and parseEmailWithAI() prompt
2. **If resolution is the issue**: Check application-resolver.ts grouping logic
3. **Share the output**: Provide the complete debug output and we can pinpoint the exact line causing the collapse

## Removing Debug Output

Once you've debugged and fixed the issue, you can remove the debug logs:

```bash
# Search for all debug logs
grep -r "console.log" lib/gmail.ts lib/application-resolver.ts

# Then remove them manually
```

Or keep them for ongoing debugging—they won't affect performance significantly.
