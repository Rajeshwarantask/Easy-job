# Debugging Ready - Two Specific Bugs

## Summary

I've added **5 strategic console.log statements** to expose both bugs. No functional changes - pure diagnostic logging to show the data flow.

## The Two Bugs

### Bug 1: All Applications Stuck at "Applied"
- 52 applications all show status "Applied"
- Interview: 0, Offer: 0, Rejected: 0
- Either: (a) AI classifies everything as "applied", OR (b) stage mapping broken

### Bug 2: Company Names Corrupted
- "reviewing the American Express" (should be "American Express")
- "your interest for the" (should be null or real company)
- "Software Engineer I - 26007841" (role, not company)
- Either: (a) Regex fallback extracting fragments, OR (b) AI returning fragments

## Debug Points Added

| Log | Location | Purpose | Shows |
|-----|----------|---------|-------|
| `[v0-AI-PARSER-RAW]` | email-parser.ts:181 | Raw Claude output | company_raw, status_raw before processing |
| `[v0-AI-PARSER-FINAL]` | email-parser.ts:215 | After processing | company (final), eventType (final) |
| `[v0-REGEX-FALLBACK]` | gmail.ts:792 | Regex fallback | company from regex, when/if used |
| `[v0-STAGE-DEBUG]` | application-resolver.ts:93 | Grouping | all event_types for each company |
| `[v0-STAGE-ASSIGNED]` | application-resolver.ts:114 | Stage mapping | last_email_eventType → final_status |

## How Each Log Helps

### Diagnosing Bug 1 (Stuck at Applied)

**Check**: `[v0-STAGE-DEBUG]` event_types array
- If all "applied" → AI is classifying everything as "applied"
- If mixed (applied, interview, offer) → Events diverse, check why final_status is "applied"

**Check**: `[v0-STAGE-ASSIGNED]` final_status
- If `last_event_type: "offer"` but `final_status: "applied"` → statusMap is broken
- If `last_event_type: "applied"` → Events aren't diverse, so AI is the problem

### Diagnosing Bug 2 (Garbage Company)

**Check**: Does `[v0-REGEX-FALLBACK]` appear?
- If YES with garbage company → Regex is the culprit
- If NO → Only AI parser used, check `[v0-AI-PARSER-RAW]`

**Check**: `[v0-AI-PARSER-RAW]` company_raw
- If garbage (e.g., "reviewing the") → Claude is returning fragments
- If null → Company extraction failed, fallback will happen

## Example Log Sequences

### Healthy Example
```
[v0-AI-PARSER-RAW] {
  subject: "Congratulations! We're excited to offer...",
  status_raw: "offer",
  company_raw: "Google"
}

[v0-AI-PARSER-FINAL] {
  company: "Google",
  eventType: "offer"
}

[v0-STAGE-DEBUG] {
  company: "Google",
  event_types: ["applied", "interview", "offer"],
  last_event_type: "offer"
}

[v0-STAGE-ASSIGNED] {
  last_email_eventType: "offer",
  final_status: "offer" ✓
}
```

### Bug 1 Example (Stuck at Applied)
```
[v0-AI-PARSER-RAW] {
  subject: "We regret to inform you...",
  status_raw: "applied"  ← WRONG (should be "rejected")
}

[v0-STAGE-DEBUG] {
  event_types: ["applied", "applied", "applied"]  ← WRONG (all applied)
}

[v0-STAGE-ASSIGNED] {
  final_status: "applied"  ← RESULT OF BUG
}
```

### Bug 2 Example (Garbage Company)
```
[v0-AI-PARSER-RAW] {
  company_raw: null  ← Extraction failed
}

[v0-REGEX-FALLBACK] {
  company: "reviewing the American Express"  ← GARBAGE
}

[v0-AI-PARSER-FINAL] {
  company: "reviewing the American Express"  ← CORRUPTED
}
```

## What to Do Now

1. **Start dev server**: `pnpm dev`
2. **Open browser**: Go to localhost:3000
3. **Open console**: F12 → Console tab
4. **Click "Sync Gmail"** button
5. **Filter console** for `[v0-` 
6. **Copy 10-15 logs** showing the pattern
7. **Send logs to me**

With logs showing 3-5 emails worth of debugging, I can identify the exact root cause and implement the fix.

## Important Notes

- These are **diagnostic logs only** - no functional changes
- They will be **removed after debugging**
- Performance impact: **negligible** (console.log is fast)
- Compatible with: **all browsers**

## Files Modified for Debugging

1. `lib/email-parser.ts` — 2 debug points (~25 lines added)
2. `lib/gmail.ts` — 1 debug point (~10 lines added)
3. `lib/application-resolver.ts` — 2 debug points (~18 lines added)

**Total**: ~53 lines of diagnostic code added

## Quick Reference

| Scenario | Check This Log | Root Cause |
|----------|---|---|
| All apps "Applied" | `[v0-STAGE-DEBUG]` event_types | AI classifying everything as applied |
| | `[v0-STAGE-ASSIGNED]` final_status | Stage mapping broken |
| Garbage company | `[v0-REGEX-FALLBACK]` | Regex fallback extracting fragments |
| | `[v0-AI-PARSER-RAW]` company_raw | AI returning fragments |

## Next Phase

Once you send logs:
1. I identify root cause (1-2 minutes)
2. Write targeted fix (5 minutes)
3. Remove debug logs (2 minutes)
4. Test fix (5 minutes)
5. Deploy (1 minute)

**Total fix time after logs: ~15 minutes**

The debugging approach beats guessing because we see the actual data at each transformation step.
