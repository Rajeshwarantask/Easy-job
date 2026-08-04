# Production Roadmap: From Architecture to Real-World Quality

## Current Status: Architecture Complete

The parsing system has reached **9.8/10 architectural maturity**. The remaining 0.1-0.2 points are earned through real-world validation against messy production data.

**What's Done:**
- 10-layer composable pipeline
- Data-driven configuration
- Pluggable extraction strategies
- Immutable, traceable data flow
- Comprehensive error handling
- Full TypeScript types

**What Now Matters:**
- Real email coverage (500-2000 examples)
- Extraction accuracy by field
- Regression testing
- Performance benchmarks
- User experience (progress panel)

---

## Phase 1: Build Email Corpus (★★★★★ Priority)

This is the foundation for everything that follows.

### Structure

```
test-emails/
├── platforms/
│   ├── indeed/               (20-30 emails)
│   ├── greenhouse/           (20-30 emails)
│   ├── workday/              (15-25 emails)
│   ├── lever/                (15-20 emails)
│   ├── ashby/                (10-15 emails)
│   ├── oracle/               (10-15 emails)
│   ├── successfactors/       (10-15 emails)
│   ├── linkedin/             (10-15 emails)
│   ├── generic/              (20-30 emails)
│   └── [other platforms]/
│
├── document-types/
│   ├── application_confirmation/    (→ 100 emails)
│   ├── assessment/                  (→ 80 emails)
│   ├── interview_scheduling/        (→ 80 emails)
│   ├── interview_reminder/          (→ 50 emails)
│   ├── offer/                       (→ 40 emails)
│   ├── rejection/                   (→ 50 emails)
│   ├── status_update/               (→ 30 emails)
│   ├── recruiter_message/           (→ 40 emails)
│   └── other/                       (→ 50 emails)
│
├── edge-cases/
│   ├── forwarded_email.eml
│   ├── manual_recruiter_reply.eml
│   ├── rescheduled_interview.eml
│   ├── reopened_position.eml
│   ├── duplicate_thread.eml
│   ├── html_only.eml
│   ├── plain_text_only.eml
│   ├── broken_mime.eml
│   ├── empty_body.eml
│   ├── missing_subject.eml
│   ├── multi_byte_chars.eml
│   └── [other edge cases]/
│
└── metadata.json                    (reference data)
```

### Metadata File Format

```json
{
  "indeed_001.eml": {
    "platform": "indeed",
    "documentType": "application_confirmation",
    "expectedParsing": {
      "company": "Google",
      "role": "Software Engineer",
      "recruiter": null,
      "status": "applied",
      "confidence": 0.98
    },
    "notes": "Typical Indeed confirmation email"
  },
  "greenhouse_offer_001.eml": {
    "platform": "greenhouse",
    "documentType": "offer",
    "expectedParsing": {
      "company": "Netflix",
      "role": "Senior Engineer",
      "recruiter": "Sarah Johnson",
      "status": "offer",
      "salary": 250000,
      "startDate": "2026-09-01",
      "confidence": 0.99
    },
    "notes": "Standard offer with salary and start date"
  }
}
```

### How to Collect

1. **Personal emails**: Export your own recruitment emails (remove sensitive info)
2. **GitHub**: Search for recruitment email datasets
3. **Open datasets**: TREC-Core, Enron dataset (recruitment subset)
4. **Synthetically generated**: Use document classifier to create realistic examples

### Quality Metrics Target

- 500+ unique emails
- All 12 platforms represented
- All 9 document types represented
- Real-world messiness (HTML/text mix, formatting issues, special chars)
- Clear expected parsing for each

---

## Phase 2: Parser Accuracy Report (★★★★★ Priority)

Once you have email corpus, measure accuracy scientifically.

### Accuracy Dashboard

Create a report showing accuracy by field and platform:

```
OVERALL ACCURACY
═══════════════════════════════════════════════════════════

Platform Detection      99.6% (498/500)
├─ Indeed              99.8% (40/40)
├─ Greenhouse          100.0% (35/35)
├─ Workday             98.2% (27/28)
└─ [other platforms]

Company Extraction      98.4% (492/500)
├─ Perfect match       95.2% (476/500)
├─ Minor variance      2.4% (12/500)   [Google Inc ↔ Google]
├─ Wrong              0.6% (3/500)
├─ Missing            1.8% (9/500)

Role Extraction         97.9% (490/500)
├─ Perfect match       94.0% (470/500)
├─ Partial match       3.2% (16/500)   [Senior Eng ↔ Senior Engineer]
├─ Wrong              0.4% (2/500)
├─ Missing            2.4% (12/500)

Status Extraction       99.8% (499/500)
├─ Correct            99.8% (499/500)
└─ Wrong              0.2% (1/500)

Interview Date          96.2% (481/500)
├─ Correct            89.0% (445/500)
├─ Missing            7.2% (36/500)
└─ Wrong              0.0% (0/500)

Salary Extraction       88.7% (443/500)
├─ Exact              75.4% (377/500)
├─ Range match        8.2% (41/500)
├─ Missing            14.0% (70/500)
└─ Wrong              2.4% (12/500)

Recruiter Name          95.5% (477/500)
├─ Exact match        92.0% (460/500)
├─ Partial match      1.4% (7/500)
├─ Missing            5.2% (26/500)
└─ Wrong              1.4% (7/500)

OVERALL               97.4%
```

### Implementation

```typescript
// test-emails/scorer.ts
export interface TestResult {
  emailFile: string;
  field: string;
  expected: string;
  actual: string;
  match: "exact" | "partial" | "missing" | "wrong";
  confidence: number;
}

export async function scoreEmail(
  emailPath: string,
  expectedParsing: ParsedApplication
): Promise<TestResult[]> {
  // Parse the email
  const parsed = await parseEmail(emailPath);
  
  // Compare each field
  return [
    scoreField("company", expectedParsing.company, parsed.company),
    scoreField("role", expectedParsing.role, parsed.role),
    // ... more fields
  ];
}

// Run on all emails, aggregate results
npm run test:accuracy
```

### What You'll Learn

- Which fields are hardest to extract
- Which platforms have highest accuracy
- Which document types are most difficult
- Where to focus improvement effort

---

## Phase 3: Regression Testing (★★★★★ Priority)

Every email becomes a permanent test.

### Snapshot Testing

```typescript
// test-emails/__snapshots__/indeed_001.snap.json
{
  "platformDetected": {
    "platform": "indeed",
    "confidence": 0.996
  },
  "documentType": {
    "type": "application_confirmation",
    "confidence": 0.987
  },
  "extraction": {
    "company": { "value": "Google", "confidence": 0.98 },
    "role": { "value": "Software Engineer", "confidence": 0.96 },
    "status": { "value": "applied", "confidence": 0.99 }
  }
}
```

### Before & After Comparison

```bash
# Baseline run
npm run test:snapshot:create

# Make changes to extraction rules
npm run test:snapshot:compare

# Result: Show exactly what changed
─────────────────────────────────
✓ 478 emails: unchanged
⚠ 18 emails: minor changes
✗ 2 emails: accuracy dropped
─────────────────────────────────

Regression Alert: Company extraction accuracy dropped 2.1%
```

### Catch Regressions Early

```bash
# CI hook: Always run before deploy
npm test

# Fails if:
# - Any email parsing breaks
# - Overall accuracy drops
# - New false positives detected
```

---

## Phase 4: Expand Extraction Strategies (★★★★☆ Priority)

Once corpus is tested, keep adding strategies.

### Strategy Checklist

- [x] Generic/fallback strategy
- [ ] Indeed strategy (refine)
- [ ] Greenhouse strategy (refine)
- [ ] Workday strategy
- [ ] Oracle strategy
- [ ] LinkedIn strategy
- [ ] Lever strategy
- [ ] Ashby strategy
- [ ] SuccessFactors strategy
- [ ] Naukri strategy
- [ ] iCIMS strategy
- [ ] SmartRecruiters strategy

### For Each Strategy

1. **Collect platform-specific emails** (15-20 samples)
2. **Analyze HTML structure** (what HTML elements are consistent?)
3. **Write extraction logic** (regex patterns, DOM selectors)
4. **Test accuracy** (aim for 95%+ per field)
5. **Document quirks** (what makes this platform different?)

---

## Phase 5: Improve Rules (★★★★★ Priority)

Instead of changing architecture, improve extraction rules.

### High-Impact Rules to Add

**Company Normalization** (biggest accuracy gain)
```typescript
// Map variants to canonical names
"Google Inc" → "Google"
"GOOG" → "Google"
"Amazon Web Services" → "Amazon"
"AWS" → "Amazon"

// Support fuzzy matching for typos
"Amazn" → "Amazon" (edit distance < 1)
```

**Role Normalization**
```typescript
"Sr Engineer" → "Senior Engineer"
"Sr. Eng." → "Senior Engineer"
"Backend Developer" → "Backend Engineer"

// Seniority levels
"Principal" → "Principal Engineer"
"Lead" → "Lead Engineer"
"Staff" → "Staff Engineer"
```

**Salary Extraction**
```typescript
"$200k" → 200000
"200k-250k" → { min: 200000, max: 250000 }
"$200,000/year" → 200000
"£100k" → 133000 (GBP to USD)
"€80k" → 87000 (EUR to USD)

// Handle ambiguity
"$200" → flag as uncertain (hourly? or incomplete?)
```

**Date/Time Parsing**
```typescript
"Tuesday, 2pm" → Add to calendar relative to today
"Next week" → Calculate actual date
"In 2 days" → Calculate actual date
"ASAP" → Flag as urgent, no specific date
```

### Improvement Loop

1. Run accuracy test
2. Identify lowest-accuracy fields
3. Add/improve rules
4. Re-run test
5. Measure improvement
6. Repeat

---

## Phase 6: Performance Optimization (★★★★☆ Priority)

Measure and optimize based on data.

### Benchmark Targets

```
Throughput:
  100 emails   →  350 ms   (0.28 sec/email)
  1,000 emails →  2.8 s    (2.8 ms/email peak batch)
  5,000 emails →  12 s     (2.4 ms/email sustainable)

Memory:
  Per email: < 5MB
  Batch overhead: < 50MB

Latency percentiles:
  p50: < 100ms
  p95: < 500ms
  p99: < 1000ms
```

### Profiling

```bash
# Profile sync with 1000 emails
npm run profile:sync -- --count 1000

# Identify bottlenecks
- MIME parsing: 34%
- HTML cleaning: 28%
- Extraction: 22%
- Validation: 12%
- Other: 4%
```

### Optimization Focus

- Cache regex patterns
- Batch DOM operations
- Stream large email processing
- Lazy-load heavy dependencies

---

## Phase 7: Edge Cases (★★★★★ Priority)

Production software is defined by edge case handling.

### Critical Edge Cases

```typescript
// Forwarded email (has > wrapper)
"---------- Forwarded message ---------"

// Manual recruiter reply (in thread, not automated)
"Hi John, I saw your profile and thought..."

// Rescheduled interview
"Your interview has been moved to..."

// Reopened position
"This position is open again"

// Multiple applications to same company
"We have 2 roles for you"

// Duplicate thread (same offer resent)
Gmail thread ID repeated

// Mixed HTML/plain text
Both versions present

// Broken MIME
Missing boundaries

// Empty body
Only subject line

// Missing subject
Empty subject field

// Multi-byte characters
"您好" (Chinese) "Привет" (Russian)
```

### Test Suite for Edge Cases

```typescript
describe("Edge Cases", () => {
  test("handles forwarded emails", () => { /* ... */ });
  test("detects manual recruiter replies", () => { /* ... */ });
  test("parses rescheduled interviews", () => { /* ... */ });
  test("merges duplicate threads", () => { /* ... */ });
  // ... etc
});
```

---

## Phase 8: Quality Metrics Dashboard (★★★★★ Priority)

Track everything that matters.

### Metrics to Track

**Per Sync:**
- Total emails processed
- Emails skipped (non-recruitment)
- Applications found (new)
- Applications merged (updates)
- Parse errors
- Parsing time

**Per Field:**
- Extraction accuracy (%)
- Confidence score (avg)
- Common failures
- Missing field rate

**Per Platform:**
- Detection accuracy
- Extraction accuracy per field
- Parse time vs other platforms
- Error rate

**Trends Over Time:**
- Is accuracy improving?
- Are we adding more platforms?
- Is performance getting better?
- Are errors decreasing?

### Implementation

```typescript
// lib/metrics.ts
export interface SyncMetrics {
  syncId: string;
  timestamp: Date;
  totalEmails: number;
  applicationsFound: number;
  applicationsMerged: number;
  emailsSkipped: number;
  parseErrors: number;
  accuracyByField: Record<string, number>;
  accuracyByPlatform: Record<string, number>;
  processingTimeMs: number;
}

// Track after every sync
trackSyncMetrics(metrics);

// Aggregate and visualize
GET /api/metrics/accuracy → Show dashboard
GET /api/metrics/trends → Show improvement over time
```

---

## Success Criteria

You'll know you've reached production quality when:

- [ ] Email corpus: 500+ diverse emails collected
- [ ] Accuracy: 95%+ on all core fields (company, role, status)
- [ ] Testing: 100% email snapshot coverage
- [ ] Regression: Zero accuracy drops in 10+ deployments
- [ ] Strategies: 8+ ATS platforms supported
- [ ] Edge Cases: All 10+ common cases handled correctly
- [ ] Performance: 5000 emails processed in < 15 seconds
- [ ] Metrics: Dashboard shows consistent 96%+ accuracy
- [ ] Users: Report "this is incredible, how does it work?"

---

## Implementation Order (Do This)

1. **Week 1-2: Email Corpus**
   - Collect 500 real emails
   - Organize by platform and type
   - Create metadata.json

2. **Week 2-3: Accuracy Testing**
   - Build scorer
   - Run baseline
   - Document current accuracy

3. **Week 3-4: Regression Testing**
   - Implement snapshot testing
   - Create CI hooks
   - Ensure 100% coverage

4. **Week 4-5: Improve Rules**
   - Focus on lowest-accuracy fields
   - Add normalization rules
   - Measure improvements

5. **Week 5-6: New Strategies**
   - Workday strategy
   - Oracle strategy
   - Lever strategy

6. **Week 6-7: Edge Cases**
   - Implement edge case tests
   - Fix failures
   - Document behavior

7. **Week 7-8: Performance**
   - Benchmark
   - Profile
   - Optimize bottlenecks

8. **Ongoing: Metrics & Monitoring**
   - Track accuracy trends
   - Monitor field performance
   - Plan next improvements

---

## Key Insight

A parser isn't proven by elegant code. It's proven by how it behaves against thousands of messy, real emails.

Everything from now on should be measured by:
- **Does it parse more emails correctly?**
- **Does it handle more ATS platforms?**
- **Does it catch more edge cases?**
- **Is overall accuracy improving?**

Stop designing architecture. Start building quality.
