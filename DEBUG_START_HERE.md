# Debug Implementation — Two Specific Bugs

## The Problems

**Bug 1**: All 52 applications stuck at "Applied"
- Interview count: 0
- Offer count: 0  
- Rejected count: 0
- **Root cause unknown**: Is AI classifying everything as "applied"? Or is stage update broken?

**Bug 2**: Company names corrupted with garbage
- "reviewing the American Express" (should be "American Express")
- "your interest for the" (should be null)
- "Software Engineer I - 26007841" (role, not a company)
- **Root cause unknown**: Is AI returning fragments? Or regex fallback?

## The Solution

Added 5 strategic console.log statements to show:
1. Raw AI parser output (what Claude extracted)
2. Final AI parser output (after processing)
3. When regex fallback is used (and what it extracts)
4. All events grouped per application
5. How final stage is assigned

**This will pinpoint exactly where each bug happens.**

## Quick Start (3 steps)

### 1. Trigger Sync
```bash
pnpm dev
# In another terminal:
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"debug": true}'
```

### 2. Open Browser Console
- Press F12 → Console tab
- Filter for `[v0-` to see only debug logs

### 3. Look for These Log Patterns
```
[v0-AI-PARSER-RAW]      — What Claude extracted
[v0-AI-PARSER-FINAL]    — After processing
[v0-REGEX-FALLBACK]     — When regex is used
[v0-STAGE-DEBUG]        — All events per app
[v0-STAGE-ASSIGNED]     — Final stage
```

## What to Look for in Logs

### For Bug 1 (Stuck at "Applied")

**If you see:**
```
[v0-STAGE-DEBUG] event_types: ["applied", "applied", "applied"]
[v0-STAGE-ASSIGNED] last_event_type: "applied", final_status: "applied"
```

**Root cause**: AI is classifying everything as "applied"
- Check: `[v0-AI-PARSER-RAW]` — all showing `status_raw: "applied"`

---

**If you see:**
```
[v0-STAGE-DEBUG] event_types: ["applied", "interview", "offer"]
[v0-STAGE-ASSIGNED] last_event_type: "offer", final_status: "applied"
```

**Root cause**: statusMap not mapping correctly
- Bug is in `lib/application-resolver.ts` line ~113

### For Bug 2 (Garbage Company)

**If you see:**
```
[v0-REGEX-FALLBACK] company: "reviewing the American Express"
```

**Root cause**: Regex fallback extracting sentence fragments
- Bug is in `lib/gmail.ts` line ~641 (extractCompany function)

---

**If you see:**
```
[v0-AI-PARSER-RAW] company_raw: "reviewing the American Express"
```

**Root cause**: Claude returning garbage
- Bug is in AI prompt, `lib/email-parser.ts` line ~13

## Files Modified

**3 files modified for debugging:**
1. `lib/email-parser.ts` — Added 2 debug logs (AI raw + final)
2. `lib/gmail.ts` — Added 1 debug log (regex fallback)
3. `lib/application-resolver.ts` — Added 2 debug logs (stage assignment)

**0 functional changes** — Pure diagnostic logging only.

## Documentation

- `QUICK_DEBUG_REFERENCE.txt` — One-page flowchart for diagnosis
- `DEBUG_LOGS_ADDED.md` — Detailed explanation of each log
- `CAPTURE_LOGS_NOW.md` — Step-by-step capture instructions

## Next Steps

1. **Run sync** (see Quick Start above)
2. **Capture logs** from browser console (F12 → Console)
3. **Filter for `[v0-`** to see only debug logs
4. **Copy 10 logs** showing the broken applications
5. **Send to me** and I'll identify the exact root cause

## After I See Your Logs

With your logs showing:
- Raw AI output (what Claude extracted)
- Final parsed output (after processing)
- Stage assignment (how final status was computed)

I can **immediately tell you**:
- Which parser is failing (AI or regex)
- Exactly which line needs fixing
- What the fix should be

Then I'll remove the debug logs and implement the surgical fix.
