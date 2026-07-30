# Easy Job App — Pipeline Debugging Guide

## Problem Statement

**You have:**
- 180+ applied emails
- 60+ rejected emails  
- 20+ interview emails
- 5+ offer emails

**But your dashboard shows:**
- Applied: 6
- Rejected: 1
- Interview: 2
- Offer: 2

**This is NOT an AI problem. This is a PIPELINE problem.**

---

## The Solution: Excellent Pipeline Architecture

We've rebuilt the sync pipeline with 7 stages and a **debugger that tracks email loss at each stage**.

### New Pipeline (7 Stages)

```
1. Gmail Fetch
   ↓
2. Deduplication (skip already-seen emails)
   ↓
3. Blocklist Filter (fast rejection)
   ↓
4. Email Parsing (AI first, regex fallback)
   ↓
5. Application Resolution (group emails by company+role)
   ↓
6. Fuzzy Matching (merge "Microsoft" vs "Microsoft Careers")
   ↓
7. Job/Event Creation (store in database/cache)
```

---

## How to Debug: Use the Debug Endpoint

### Step 1: Trigger a sync with debug output

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"debug": true}'
```

### Step 2: Read the console output

You'll see logs like:

```
[Pipeline] Fetched page 1: 150 emails (total: 150)
[Pipeline] Fetched page 2: 87 emails (total: 237)
[Pipeline] Total emails from Gmail: 237
[Pipeline] New messages to process: 215/237
[Pipeline] Parsed emails: 198/215
[Pipeline] Resolved applications: 45 (from 198 emails)
```

### Step 3: Check the response JSON

The API returns:

```json
{
  "newJobs": 12,
  "newEvents": 34,
  "errors": [],
  "debug": {
    "stages": [
      {
        "stage": "fetch",
        "input": 1,
        "output": 1,
        "filtered": 0
      },
      {
        "stage": "deduplication",
        "input": 237,
        "output": 215,
        "filtered": 22,
        "filterReason": {
          "already_seen": 22
        }
      },
      {
        "stage": "parsing",
        "input": 215,
        "output": 198,
        "filtered": 17,
        "filterReason": {
          "blocked_sender": 5,
          "low_confidence": 12
        }
      },
      {
        "stage": "resolution",
        "input": 198,
        "output": 45,
        "filtered": 153
      }
    ],
    "totalInputEmails": 237,
    "totalOutputApplications": 45,
    "lossPercentage": "81.0%"
  }
}
```

---

## Understanding the Debug Output

### Good scenarios:

**High retention through parsing (90%+)**
```
Fetch: 237 → 237
Dedup: 237 → 215  (lost 22 = already seen, OK)
Parse: 215 → 198  (lost 17 = 7.9%, OK)
Resolve: 198 → 45 (lost 153 = multiple emails per app, EXPECTED)
```

**Final: 45 applications from 237 emails = 5 emails per application on average** ✅

---

### Bad scenarios:

**Loss during parsing (>20%)**
```
Parse: 215 → 150 (lost 65 = 30%, PROBLEM!)
```

**Causes to check:**
1. **Confidence threshold too high** — Emails below MIN_CONFIDENCE are discarded
2. **AI parser failing** — Claude call returning null, regex fallback too strict
3. **Blocked senders misconfig** — Legitimate recruiters in blocklist

**Fix:**
- Lower MIN_CONFIDENCE from 2 to 1.5
- Add logging to see which emails are failing
- Check blocklist for false positives

---

**Loss during resolution (50%+)**
```
Parse: 198 → 100  (lost 98)
```

**This could mean:**
1. Each application has ~2 emails (good, expected)
2. Or: Matching algorithm is too strict, creating duplicates

**Check:**
- Are "Microsoft" and "Microsoft Careers" merging correctly?
- Is fuzzy matching working?
- Check the `emailLog` in debug output for specifics

---

## Implementation Details

### New Files

1. **`lib/pipeline-debug.ts`**
   - `PipelineDebugger` class tracks email loss at each stage
   - Records per-email logs for detailed inspection

2. **`lib/application-resolver.ts`**
   - `resolveApplications()` — Groups emails by (company, role)
   - `fuzzyMatchApplications()` — Merges similar company names using Levenshtein distance
   - This is where 5 "Applied" emails + 1 "Interview" email = 1 application

### Modified Files

1. **`lib/gmail.ts`**
   - Added pagination loop (was capped at 150, now fetches ALL)
   - Integrated `PipelineDebugger`
   - Integrated `application-resolver`
   - All 7 stages now have debug checkpoints

2. **`app/api/sync/route.ts`**
   - Added debug mode endpoint
   - Returns full debug object when `?debug=true`

---

## Troubleshooting: Common Issues

### Issue: Still showing wrong numbers after fix

**Checklist:**
1. Did you clear browser cache? (SessionStorage still has old data)
2. Did you sign out and back in? (Resets in-memory store)
3. Are you looking at the console logs, not just the API response?

### Issue: 80% loss in parsing stage

**Most likely:** Confidence threshold or AI parser unavailable

**Debug step:**
```typescript
// Add this to lib/gmail.ts around line 710
console.log(`[v0] Email: ${subject}`);
console.log(`[v0] Parsed:`, parsed);
if (!parsed) {
  console.log(`[v0] Failed to parse. AI error? Confidence too low?`);
}
```

### Issue: Applications not merging

**Debug step:**
Look at `pipelineDebugger.emailLog` to see which emails went into which application.

If "Microsoft" and "Microsoft Careers" aren't merging:
1. Check Levenshtein distance (should be ≤1)
2. Lower the threshold in `application-resolver.ts` line 150

---

## Performance Tips

1. **Pagination is now efficient:**  
   Each page = 100 emails, multiple pages handled correctly

2. **AI + Regex fallback:**  
   If Claude is slow, regex kicks in instantly

3. **Fuzzy matching is O(n log n):**  
   45 applications = negligible time

---

## Next Steps

Once you verify the pipeline is working:

1. **Monitor real-world data** — Compare debug output with actual email count
2. **Fine-tune thresholds** — Adjust MIN_CONFIDENCE based on what you're losing
3. **Add more rules** — If regex is missing patterns, add them to SUBJECT/SNIPPET patterns
4. **Consider caching** — Currently fetches all 90 days every sync; add incremental sync later

---

## Questions?

- Check `console.log("[Pipeline] ...")` messages in dev server
- Enable debug mode on the API to see full pipeline breakdown
- Look at `emailLog` in debug output to trace specific email failures
