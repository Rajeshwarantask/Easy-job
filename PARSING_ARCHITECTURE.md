# The 10-Layer Parsing Architecture

This document explains how JobTrail converts messy recruitment emails into perfect application records. The architecture is based on **problem-solving layers**, not technical patterns.

## The Core Problem

Your input is chaos:
- HTML, plain text, multipart emails
- Random ATS templates
- Forwarded messages
- Quoted replies
- Recruiter spam
- Newsletter noise

Your output must always be:
```json
{
  "application": "...",
  "company": "...",
  "role": "...",
  "status": "...",
  "timeline": [...]
}
```

## The 10 Layers

### Layer 1: Input Normalization
**File**: `mime-decoder.ts`, `html-cleaner.ts`

**Problem**: Every email format is different.

**Responsibility**: Convert any email to ONE normalized structure:
- `subject`: Email subject
- `from`: Sender email
- `body`: Plain text version
- `html`: HTML version (cleaned)
- `links`: All extracted URLs
- `headers`: Email headers
- `attachments`: File attachments
- `thread`: Gmail thread info
- `date`: Send date

**Why first**: Everything downstream depends on normalized input.

**Example**:
```
Input: Raw Gmail MIME with multipart/alternative
Output: {
  subject: "Application Received",
  from: "careers@company.com",
  body: "Thank you for applying...",
  html: "<p>Thank you for applying...</p>",
  links: ["https://careers.company.com/positions/123"],
  date: "2026-08-10T10:00:00Z"
}
```

---

### Layer 2: Recruitment Classification
**File**: `recruitment-filter.ts`

**Problem**: 90% of emails aren't job-related. Don't waste time parsing newsletters.

**Responsibility**: Answer: "Is this recruitment-related?"

**Output**:
- `isRecruiting: true|false`
- `confidence: 0.0-1.0`
- `reason: string`

**Example**:
```
Input: Email from "marketing@company.com" about "Q3 Newsletter"
Output: {
  isRecruiting: false,
  confidence: 0.95,
  reason: "Newsletter pattern detected"
}
```

**Rules**:
- If confidence < 0.8, it's recruitment-related
- If confidence >= 0.8 and not recruiting, skip it
- If recruiting, continue to Layer 3

---

### Layer 3: Document Understanding
**File**: `document-classifier.ts`

**Problem**: Different email types need different extraction strategies.

**Responsibility**: Answer: "What TYPE of recruitment email is this?"

**Output**: One of:
- `application_confirmation`: "Thank you for applying"
- `assessment`: "Take the coding test"
- `interview_scheduling`: "Can you interview on Tuesday?"
- `interview_reminder`: "Your interview is tomorrow"
- `offer`: "We'd like to offer you"
- `rejection`: "We decided to move forward with..."
- `recruiter_message`: "I came across your profile"
- `job_recommendation`: "We have a role for you"
- `status_update`: "Your application status"
- `deadline_reminder`: "Application closes soon"
- `marketing`: "Career fair next week"
- `unknown`: Couldn't classify

**Confidence**: 0.0-1.0

**Why this matters**: 
- Assessment emails need link extraction
- Interview emails need date/time parsing
- Offers need salary extraction
- Generic approach misses nuances

**Example**:
```
Subject: "Next Steps: Interview Scheduled"
Body: "We'd like to interview you on August 15 at 2pm via Zoom"

Output: {
  type: "interview_scheduling",
  confidence: 0.92,
  signals: ["subject_interview_scheduling", "body_interview_availability"]
}
```

---

### Layer 4: Information Extraction
**File**: `parsers/`, `field-extractors/`

**Problem**: Extract facts from unstructured text.

**Responsibility**: For each field (company, role, salary, date, etc), answer:
- What is the value?
- How confident are we?
- Where did it come from?

**Output**: `{ value, confidence, source }`

**Strategy**:
1. Platform-specific parser runs first (Indeed, Greenhouse, etc)
2. Generic regex patterns as fallback
3. Each extractor produces multiple candidates
4. Multiple extractors attempt same field

**Extractors**:
- Company extractor (from domain, signature, body patterns)
- Role extractor (from subject, posting, body)
- Salary extractor (from ranges, hourly rates, ranges with currency)
- Location extractor (from job posting, company info)
- Date extractor (interview dates, deadlines, send dates)
- Link extractor (interview links, career portal links)
- Recruiter extractor (name, email, title)

**Example**:
```
Body: "Senior Software Engineer at Google, $200k-250k/year, San Francisco"

Output: {
  company: { value: "Google", confidence: 0.95, source: "body_pattern" },
  role: { value: "Senior Software Engineer", confidence: 0.9, source: "body_pattern" },
  salary: { value: 225000, confidence: 0.85, source: "regex_range" },
  location: { value: "San Francisco", confidence: 0.8, source: "body_pattern" }
}
```

---

### Layer 5: Validation
**File**: `validation.ts`

**Problem**: Extracted facts might be nonsensical.

**Responsibility**: Check if facts make sense together.

**Validation Rules**:
- Deadline can't be in past
- Interview date must be after application date
- Salary must be positive and reasonable (< $10M)
- Location must match company headquarters
- No circular logic (applying for same job twice in same email)

**Output**:
- `valid: true|false`
- `criticalIssues: [...]`: Facts that can't be trusted
- `warnings: [...]`: Unusual but possible
- `overallConfidence: 0.0-1.0`: How much to trust this parse

**Example**:
```
company: "Google"
role: "CEO"
salary: 10000000

Issues: [
  "Salary $10M is extremely high, likely incorrect",
  "CEO roles are rarely filled via email application"
]
overallConfidence: 0.4
```

---

### Layer 6: Resolution
**File**: `field-resolver.ts`

**Problem**: Multiple extractors produced different values for the same field.

**Responsibility**: Pick the winner.

**Resolution Strategy**:
1. All extractors agree? Use that value
2. Highest confidence wins
3. Canonical sources (company domain > email body > fallback)
4. Check consistency (company name must match domain)

**Output**: Single `ResolvedField`:
```
{
  value: "Google",
  confidence: 0.95,
  source: "company_domain",
  extractors: ["domain_extractor", "body_pattern"],
  conflictResolution: "canonical",
  reasoning: "Company domain is most reliable source"
}
```

**Why this layer**: Prevents garbage-in-garbage-out. Better to be confident about ONE answer than uncertain about many.

---

### Layer 7: Identity Resolution
**File**: `identity-resolver.ts`

**Problem**: THE HARDEST PROBLEM. Does this email belong to a new application or update an existing one?

**Responsibility**: Answer: "Is this Applied → Interview → Offer sequence ONE application or three?"

**Identity Signals** (in priority order):
1. **Same Gmail thread ID** → Definitive match (99% confidence)
2. **Same recruiter email** + same company/role → Very strong (95%)
3. **Same company + role within 7 days** → Likely match (92%)
4. **Same company + role within 30 days** → Possible match (85%)
5. **Fuzzy match 85%+ within 60 days** → Consider merging (75%)

**Output**:
```
{
  isNewApplication: false,
  matchedApplicationId: "app_xyz123",
  confidence: 0.95,
  reasoning: "Same Gmail thread ID. Continuation of existing application."
}
```

**Why this matters**: Without this layer, Applied + Interview + Offer = 3 rows. WITH this layer = 1 application with 3 states. This is what makes the dashboard useful.

---

### Layer 8: State Engine
**File**: `state-engine.ts`

**Problem**: Track current state vs history.

**Responsibility**: Answer:
- What is the current application state?
- How did it get here?
- Is this transition valid?

**States**:
- `applied`: Initial application
- `assessment`: Coding test, interview, etc
- `interview`: Interview scheduled/completed
- `offer`: Job offer received
- `rejected`: Application rejected

**Output**:
```
{
  currentState: "interview",
  stateEnteredDate: "2026-08-10T10:00:00Z",
  history: [
    { fromState: "applied", toState: "assessment", date: "...", daysInPreviousState: 3 },
    { fromState: "assessment", toState: "interview", date: "...", daysInPreviousState: 2 }
  ],
  isRejected: false,
  isOfferActive: false
}
```

**Validation**:
- Can't go backwards (interview → applied)
- Can't proceed after rejection
- Can track "next expected state" (e.g., expect offer within 10 days of interview)

---

### Layer 9: Timeline Engine
**File**: `timeline-builder.ts`

**Problem**: Convert extracted facts into timeline events.

**Responsibility**: Build human-readable timeline.

**Output**:
```
[
  {
    type: "applied",
    date: "2026-08-01",
    time: "09:00",
    description: "Applied via Indeed"
  },
  {
    type: "assessment",
    date: "2026-08-05",
    time: "10:00",
    description: "Coding assessment completed"
  },
  {
    type: "interview",
    date: "2026-08-10",
    time: "14:00",
    link: "https://zoom.us/j/...",
    interviewer: "John Smith (Hiring Manager)",
    description: "Technical interview via Zoom"
  }
]
```

---

### Layer 10: Output Builder
**File**: `sync-orchestrator.ts` (final step)

**Problem**: Package everything into final `ParsedApplication`.

**Responsibility**: Create single source of truth.

**Output**: `ParsedApplication`
```typescript
{
  // Original email
  originalEmail: {
    gmailMessageId: "...",
    gmailThreadId: "...",
    from: "careers@company.com",
    subject: "Application Received",
    date: "2026-08-01T09:00:00Z",
    bodyText: "..."
  },

  // Parsed fields (resolved)
  company: "Google",
  companyConfidence: 0.95,
  role: "Software Engineer",
  roleConfidence: 0.92,
  location: "San Francisco",
  workMode: "hybrid",

  // ATS fields
  applicationId: "app_12345",
  requisitionId: "req_67890",

  // State
  eventType: "applied",
  currentState: "applied",
  stateHistory: [...],

  // Timeline
  timelineEvents: [...],

  // Mapping
  mapTo: { action: "create"|"update", applicationId: "..." },

  // Parser metadata
  parsedBy: "greenhouse",
  parserVersion: "1.0.0",
  parserConfidence: 0.92,

  // Validation
  validation: {
    valid: true,
    criticalIssues: [],
    warnings: [],
    overallConfidence: 0.92
  },

  // Audit
  extractedAt: "2026-08-15T10:00:00Z",
  extractionDurationMs: 145
}
```

---

## Why This Architecture Scales

### Tomorrow: Add Oracle Recruiting Parser
Only `oracle-parser.ts` is added. Architecture doesn't change.

### Tomorrow: LinkedIn Changes Template
Only `linkedin-extractor.ts` changes. Architecture doesn't change.

### Tomorrow: Use AI for Extraction
Replace Layer 4 implementation. Layers 1-3, 5-10 are unchanged.

### Tomorrow: Add New Validation Rule
Only Layer 5 (`validation.ts`) changes.

### Tomorrow: Change State Model
Only Layer 8 (`state-engine.ts`) changes.

---

## The Guiding Questions

A good architecture answers one question at each layer:

1. **What is this email?** (Normalization)
2. **Should I care about it?** (Classification)
3. **What kind of recruitment email is it?** (Document Understanding)
4. **What facts can I extract?** (Extraction)
5. **Are those facts valid?** (Validation)
6. **Which facts are most trustworthy?** (Resolution)
7. **Which application does this belong to?** (Identity Resolution)
8. **What is the application's current state?** (State Engine)
9. **How should the user see this history?** (Timeline Engine)
10. **What structured object should the rest of the app receive?** (Output Builder)

If you can answer these 10 questions, you have a perfect parse.

---

## Implementation Checklist

- [x] Layer 1: Input Normalization (mime-decoder + html-cleaner)
- [x] Layer 2: Recruitment Classification (recruitment-filter)
- [x] Layer 3: Document Understanding (document-classifier) ✨ NEW
- [x] Layer 4: Information Extraction (parsers)
- [x] Layer 5: Validation (validation)
- [x] Layer 6: Resolution (field-resolver) ✨ NEW
- [x] Layer 7: Identity Resolution (identity-resolver) ✨ NEW
- [x] Layer 8: State Engine (state-engine) ✨ NEW
- [x] Layer 9: Timeline Engine (timeline-builder)
- [x] Layer 10: Output Builder (sync-orchestrator)

---

## Testing This Architecture

Create test emails for each document type:
- Application confirmation
- Assessment request
- Interview scheduling
- Offer letter
- Rejection
- Recruiter outreach

For each, verify:
1. Correctly classified (Layer 3)
2. All fields extracted (Layer 4)
3. Facts validated (Layer 5)
4. Resolved to single winner (Layer 6)
5. Correctly mapped to existing application (Layer 7)
6. State transition is valid (Layer 8)
7. Timeline is accurate (Layer 9)

If all pass, the parse is 98% correct. UI is the remaining 2%.
