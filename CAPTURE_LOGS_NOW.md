# Debug Log Capture Instructions

## What Was Added

I added 4 debug log points to trace the exact root cause of both bugs:

### 1. AI Parser Raw Output
**File**: `lib/email-parser.ts` (line ~181)
**Output**: `[v0-AI-PARSER-RAW]` - Shows what Claude returns BEFORE any processing
```
Shows: company_raw, company_confidence, status_raw, status_confidence
```

### 2. AI Parser Final Output
**File**: `lib/email-parser.ts` (line ~215)
**Output**: `[v0-AI-PARSER-FINAL]` - Shows what the parser returns AFTER processing
```
Shows: company (final), eventType (final)
```

### 3. Regex Fallback
**File**: `lib/gmail.ts` (line ~792)
**Output**: `[v0-REGEX-FALLBACK]` - Shows when regex is used instead of AI
```
Shows: company, eventType, parsedBy="rules"
This reveals if regex is overriding AI with garbage company names
```

### 4. Stage Assignment
**File**: `lib/application-resolver.ts` (line ~93 & ~114)
**Output**: 
- `[v0-STAGE-DEBUG]`: All events for application
- `[v0-STAGE-ASSIGNED]`: Final stage assignment

```
Shows: all event_types processed, last_event_type, final_status
```

## How to Capture Logs

### Option A: Browser Console (Recommended for Quick Capture)

1. Open your app in browser
2. Open DevTools (F12 or Cmd+Option+J)
3. Go to Console tab
4. Click "Sync Gmail" button
5. Watch real-time logs appear with `[v0-*]` prefix
6. Filter console for `[v0-` to see only debug logs
7. Right-click → "Save as" to export console

### Option B: Terminal Output (For Complete Capture)

1. **Terminal 1**: Run dev server
   ```bash
   pnpm dev 2>&1 | tee sync.log
   ```

2. **Terminal 2**: Trigger sync
   ```bash
   curl -X POST http://localhost:3000/api/sync \
     -H 'Content-Type: application/json' \
     -d '{"debug": true}'
   ```

3. **Back in Terminal 1**: Watch for logs
   - Look for all `[v0-*]` lines
   - Copy them to a file or screenshot

### Option C: API Response (For Server-Side Capture)

If the `/api/sync` endpoint returns debug data, you can see logs there.

## What to Look For

### Bug 1: Status Stuck at "Applied"

**Good sequence:**
```
[v0-STAGE-DEBUG] company: "Google", event_types: ["applied", "interview", "offer"]
[v0-STAGE-ASSIGNED] last_event_type: "offer", final_status: "offer"
```

**Bad sequence (what we're probably seeing):**
```
[v0-STAGE-DEBUG] company: "Google", event_types: ["applied", "applied", "applied"]
[v0-STAGE-ASSIGNED] last_event_type: "applied", final_status: "applied"
```

The `event_types` array shows all emails classified. If all are "applied" despite containing "interview" or "rejected" emails, **the AI parser is wrong**.

### Bug 2: Garbage Company Names

**Good output:**
```
[v0-AI-PARSER-RAW] company_raw: "Google", company_confidence: 0.95
[v0-AI-PARSER-FINAL] company: "Google"
```

**Bad output (what we expect):**
```
[v0-AI-PARSER-RAW] company_raw: null, company_confidence: 0.2
[v0-REGEX-FALLBACK] company: "reviewing the American Express"
```

If you see `[v0-REGEX-FALLBACK]` with garbage company, **the regex parser is the culprit**.

## Examples to Search For

From your dashboard errors:

### Example 1: "reviewing the American Express"
Find logs with:
```
subject: "...American Express..."
company: "reviewing the American Express"
```

### Example 2: "your interest for the"
Find logs with:
```
company: "your interest for the"
```

### Example 3: "NeST Digital Recruit" + sentence fragment
Find logs with:
```
company: "NeST Digital Recruit"  (or the long fragment version)
```

### Example 4: "Software Engineer I - 26007841"
Find logs with:
```
company: "Software Engineer I - 26007841"
status_confidence: should be low if it's really a role not a company
```

## After Capturing Logs

**Please send me:**
1. All logs containing `[v0-AI-PARSER-RAW]` for 5-10 emails (copy paste from console)
2. Any logs containing `[v0-REGEX-FALLBACK]` (shows when/if regex is used)
3. All logs containing `[v0-STAGE-DEBUG]` and `[v0-STAGE-ASSIGNED]` 
4. The 4 specific broken examples from your dashboard (screenshot if possible)

With these logs, I can:
- See exactly where company names are corrupted (AI vs regex)
- See why all events are classified as "applied"
- Pinpoint the exact line causing the issue
- Write a targeted fix instead of guessing

## Important

These console.log statements are ONLY for debugging. Once we identify the root cause, we'll remove them before production.
