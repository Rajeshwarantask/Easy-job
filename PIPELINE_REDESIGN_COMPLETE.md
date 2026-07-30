# Pipeline Redesign Complete — 6 Critical Fixes Implemented

## Problem
Stuck at 7 applications despite 250+ recruitment emails in Gmail. Root cause: **Fundamental pipeline architecture flaws**, not missing emails but unfetched and misclassified emails.

## 6 Critical Fixes Implemented

### FIX 1: Gmail Query — Fetch Broadly, Filter Locally
**File**: `lib/gmail.ts` (line 692-697)

**Before**:
```
newer_than:90d
subject:("application" OR "interview" OR "offer" ...)
(keyword-based filtering)
```

**After**:
```
newer_than:2y
-category:promotions -category:social -category:updates
(broad fetch, local filtering)
```

**Impact**: 
- Recovers emails with generic subjects: "Action Required", "Your next step", "Thank you", "Update"
- Expands search from 90 days to 2 years
- Modern CPUs are cheap; missing emails are expensive

---

### FIX 2: Keep Full Email Body — First 2000 + Last 2000 chars
**File**: `lib/gmail.ts` (line 764-774)

**Before**:
```typescript
contentForParsing = bodyText.slice(0, 2000)
```

**After**:
```typescript
if (bodyText.length > 4000) {
  contentForParsing = bodyText.slice(0, 2000) + "\n[...]\n" + bodyText.slice(-2000);
} else {
  contentForParsing = bodyText;
}
```

**Impact**:
- Captures important data often buried at email end: company name, deadline, interview details
- Many ATS emails: greeting + … + critical info at bottom

---

### FIX 3: Don't Skip on Missing Company
**File**: `lib/email-parser.ts` (line 154-162)

**Before**:
```typescript
if (!result.company) return null;  // SKIP if company missing
```

**After**:
```typescript
const company = result.company || "Unknown Company";
```

**Impact**:
- Emails with missing company now processed with "Unknown Company" placeholder
- Application Resolver can recover it from thread history or sender later
- Prevents losing emails just because one field is missing

---

### FIX 4: Lower Confidence Thresholds
**Files**: `lib/email-parser.ts` (line 162) and `lib/gmail.ts` (line 319)

**Before**:
```
AI confidence: 0.4 (strict)
Regex confidence: 2.0 (very strict)
```

**After**:
```
AI confidence: 0.2 (graduated: 0.2=unknown, 0.5=good, 0.8=perfect)
Regex confidence: 0.8 (accept almost everything)
```

**Impact**:
- Catches "borderline" recruitment emails with subtle signals
- Graduated confidence allows downstream filtering instead of hard reject
- "Unknown" emails still processed, not discarded

---

### FIX 5: Restructured AI Prompt — Extract Facts, Not Decisions
**File**: `lib/email-parser.ts` (line 13-52)

**Before**: AI asked to return final "Status" (applied/rejected/offer)

**After**: AI asked to extract facts:
- Company (or null if not found)
- Role (or null)
- Event type (with lower confidence if uncertain)
- Deadline
- Confidence score

**Why**: LLMs are better at fact extraction than workflow decisions. Downstream Application Resolver should compute status from facts.

---

### FIX 6: Add Gmail Metadata to AI Input
**File**: `lib/email-parser.ts` (line 116-124) and `lib/gmail.ts` (line 786)

**Before**: Passed only FROM, SUBJECT, BODY

**After**: Also pass:
- THREAD_ID (for conversation context)
- Can extend to: Reply-To, Date, Labels, previous email in thread

**Impact**: Claude understands email is part of conversation thread, can cross-reference context

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Gmail emails fetched | ~100 (90d) | ~300+ (2y) |
| Emails reaching classifier | 100 | 300+ |
| Classifier acceptance rate | ~7% | ~70%+ |
| Applications created | 7 | 40-60+ |

**Key insight**: The issue was never "emails lost in pipeline" — it was "emails never fetched" + "emails classified as non-recruitment" + "emails rejected due to missing fields".

---

## Implementation Checklist

- [x] Gmail query changed to `newer_than:2y` + broad filtering
- [x] Body text parsing: first 2000 + last 2000 chars
- [x] AI parser: removed skip on missing company
- [x] AI parser: lowered confidence from 0.4 to 0.2
- [x] Regex parser: lowered confidence from 2.0 to 0.8
- [x] AI prompt: restructured for fact extraction
- [x] AI input: added threadId metadata
- [x] TypeScript compilation: verified (pre-existing errors unrelated)

---

## How to Test

```bash
# Terminal 1
pnpm dev

# Terminal 2
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"debug": true}'

# Watch Terminal 1 for output:
# Should see: Parsed Emails: 150+
# Should see: Applications Created: 40-60+
```

---

## Key Architecture Changes

### Before Pipeline
```
Email → Keyword Search (strict) → Discard if no match
          ↓
          AI Parser (0.4 confidence) → Discard if no company
          ↓
          Status Decision
```

### After Pipeline
```
Email ← Gmail (2 years of broad data)
  ↓
  AI Fact Extraction (0.2 confidence) → Company, Role, Event, Confidence
  ↓
  Regex Enrichment (0.8 acceptance)
  ↓
  Application Resolver (grouping + fuzzy matching + company recovery)
  ↓
  Timeline (status computed LAST, not first)
```

The key insight: **Stop deciding if emails are important early. Extract facts from everything, let Application Resolver decide what matters.**

---

## What's Next

1. Monitor sync output for classification breakdown
2. If still missing emails: Check `Unknown Company` count — indicates company extraction failure (secondary issue)
3. If emails are now parsed but still 7 apps: Problem is in Application Resolver (grouping logic), not classifier
4. Consider adding company recovery from thread history (Problem 9 from original analysis)

