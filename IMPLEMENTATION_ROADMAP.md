# Implementation Roadmap: Deterministic Job Application Parser

## Quick Start: Transition Plan

### Current State (v3.1.0)
- Gemini AI fallback for ambiguous emails
- 8 platform parsers (Indeed, Greenhouse, Workday, Lever, Ashby, Oracle, SuccessFactors, Taleo)
- Generic regex parser
- Early recruitment classifier
- Domain-based company extraction

### Target State (v4.0.0)
- AI disabled by default (optional fallback only)
- 14+ platform parsers with full coverage
- Advanced deterministic extraction
- Confidence-based decision making
- Zero external dependencies for core parsing

---

## Phase 1: Enable AI-Optional Mode

**Duration:** 1 sprint

### Step 1a: Add Configuration Layer

Create `lib/config.ts`:
```typescript
export interface ParserConfig {
  useDeterministicOnly: boolean;
  aiEnabled: boolean;
  aiConfidenceThreshold: number; // 0.0-1.0
  aiModel: string;
  aiCostBudget: number; // dollars
  debugMode: boolean;
}

export const defaultConfig: ParserConfig = {
  useDeterministicOnly: true,      // PRODUCTION DEFAULT
  aiEnabled: false,                 // Disabled by default
  aiConfidenceThreshold: 0.7,
  aiModel: 'gemini-2.0-flash',
  aiCostBudget: 0,
  debugMode: false,
};

export function getConfig(): ParserConfig {
  return {
    ...defaultConfig,
    // Override from environment if present
    useDeterministicOnly: process.env.PARSER_USE_DETERMINISTIC_ONLY !== 'false',
    aiEnabled: process.env.PARSER_ENABLE_AI === 'true',
    aiCostBudget: parseFloat(process.env.PARSER_AI_BUDGET || '0'),
  };
}
```

### Step 1b: Update Pipeline Gate

Modify `lib/gmail.ts` parsing logic:
```typescript
const config = getConfig();

// Only call AI if:
// 1. AI is explicitly enabled, AND
// 2. Confidence is below threshold
const shouldCallAI =
  !config.useDeterministicOnly &&
  config.aiEnabled &&
  deterministic.final_confidence < config.aiConfidenceThreshold;

if (shouldCallAI) {
  aiResult = await parseEmailWithAI(...);
} else {
  tracer.log('AI Skipped', `confidence ${deterministic.final_confidence.toFixed(2)} sufficient`);
}
```

### Step 1c: Add Telemetry

Track how often AI would be invoked:
```typescript
// lib/pipeline/telemetry.ts
export interface PipelineMetrics {
  totalEmails: number;
  deterministicSuccess: number;       // Parsed without AI
  deterministicLowConfidence: number;  // Would need AI
  aiCalls: number;
  averageConfidence: number;
}

export class TelemetryCollector {
  record(metric: string, value: number) {
    console.log(`[TELEMETRY] ${metric}: ${value}`);
  }
}
```

---

## Phase 2: Expand Platform Parsers

**Duration:** 2 sprints

### Implement These Parsers

#### SmartRecruiters
```typescript
// lib/parsers/platform/smartrecruiters.ts
export const SmartRecruitersParser: Parser = {
  name: 'SmartRecruiters',
  platform: 'smartrecruiters',
  
  canHandle: (from) => from.includes('@smartrecruiters.com'),
  
  parse: (from, subject, body) => {
    // Extract: candidate_id, application_id from URL patterns
    // Status: subject line keywords ("Application Received", "Interview Scheduled")
    // Role: from body context
  }
};
```

#### Naukri (India)
```typescript
// lib/parsers/platform/naukri.ts
export const NaukriParser: Parser = {
  name: 'Naukri',
  platform: 'naukri',
  
  canHandle: (from) => from.includes('@naukri.com') || from.includes('@naukrigulf.com'),
  
  parse: (from, subject, body) => {
    // Handle Hindi/Urdu characters
    // Extract: role, company, salary range
    // Status: subject-based classification
  }
};
```

#### iCIMS
```typescript
// lib/parsers/platform/icims.ts
export const ICiMSParser: Parser = {
  name: 'iCIMS',
  platform: 'icims',
  
  canHandle: (from) => from.includes('@icims.com'),
  
  parse: (from, subject, body) => {
    // Extract: application_id from body patterns
    // Status: from email type and subject keywords
  }
};
```

#### Jobvite
```typescript
// lib/parsers/platform/jobvite.ts
export const JobviteParser: Parser = {
  name: 'Jobvite',
  platform: 'jobvite',
  
  canHandle: (from) => from.includes('@jobvite.com'),
  
  parse: (from, subject, body) => {
    // Status: interview/offer/rejection keywords in subject
    // Role: from body content
  }
};
```

#### LinkedIn Jobs (Advanced)
```typescript
// lib/parsers/platform/linkedin.ts
export const LinkedInJobsParser: Parser = {
  name: 'LinkedIn Jobs',
  platform: 'linkedin',
  
  canHandle: (from) => from.includes('@linkedin.com'),
  
  parse: (from, subject, body) => {
    // Detect: forwarded recruiter message vs. direct LinkedIn notification
    // Extract: company from sender (may be forwarded)
    // Status: infer from context (usually "update" or "message")
  }
};
```

#### Wellfound (YC)
```typescript
// lib/parsers/platform/wellfound.ts
export const WellfoundParser: Parser = {
  name: 'Wellfound',
  platform: 'wellfound',
  
  canHandle: (from) => from.includes('@wellfound.com') || from.includes('@angel.co'),
  
  parse: (from, subject, body) => {
    // YC startup context
    // Extract: startup name, role, stage
  }
};
```

### Parser Registry

Update `lib/parsers/parser-registry.ts`:
```typescript
import { IndeedParser } from './platform/indeed';
import { GreenhouseParser } from './platform/greenhouse';
import { WorkdayParser } from './platform/workday';
import { LeverParser } from './platform/lever';
import { AshbyParser } from './platform/ashby';
import { OracleParser } from './platform/oracle';
import { SuccessFactorsParser } from './platform/successfactors';
import { TaleoParser } from './platform/taleo';
import { SmartRecruitersParser } from './platform/smartrecruiters';
import { ICiMSParser } from './platform/icims';
import { JobviteParser } from './platform/jobvite';
import { NaukriParser } from './platform/naukri';
import { LinkedInJobsParser } from './platform/linkedin';
import { WellfoundParser } from './platform/wellfound';

export const PLATFORM_PARSERS: Parser[] = [
  IndeedParser,
  GreenhouseParser,
  WorkdayParser,
  LeverParser,
  AshbyParser,
  OracleParser,
  SuccessFactorsParser,
  TaleoParser,
  SmartRecruitersParser,
  ICiMSParser,
  JobviteParser,
  NaukriParser,
  LinkedInJobsParser,
  WellfoundParser,
];

export function getPlatformParser(from: string, subject: string): Parser | null {
  for (const parser of PLATFORM_PARSERS) {
    if (parser.canHandle(from, subject)) {
      return parser;
    }
  }
  return null;
}
```

---

## Phase 3: Advanced Extraction

**Duration:** 1-2 sprints

### Date Extraction from Calendar

```typescript
// lib/extraction/dates.ts
export function extractInterviewDate(body: string, headers: Record<string, string>): string | null {
  // Strategy 1: iCal format (from email headers)
  const icalMatch = headers['content-type']?.includes('text/calendar');
  if (icalMatch) {
    return parseICalendar(body);
  }

  // Strategy 2: Common date patterns
  const datePatterns = [
    /(?:interview|meeting|call)\s+(?:scheduled\s+)?(?:for|on|at)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\w+\s+\d{1,2})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
  ];

  for (const pattern of datePatterns) {
    const match = body.match(pattern);
    if (match) return parseDate(match[0]);
  }

  return null;
}
```

### Link Extraction

```typescript
// lib/extraction/links.ts
export function extractLinks(body: string): {
  interviewLink?: string;
  assessmentLink?: string;
  jobUrl?: string;
  careerPortalUrl?: string;
} {
  const links = {
    interviewLink: undefined as string | undefined,
    assessmentLink: undefined as string | undefined,
    jobUrl: undefined as string | undefined,
    careerPortalUrl: undefined as string | undefined,
  };

  const urls = extractAllUrls(body);
  
  for (const url of urls) {
    if (/zoom|meet\.google|teams|jitsi/i.test(url)) {
      links.interviewLink = url;
    }
    if (/assessment|hackerrank|codility|leetcode/i.test(url)) {
      links.assessmentLink = url;
    }
    if (/jobs|career|position|apply/i.test(url)) {
      links.jobUrl = url;
    }
    if (/talent|recruit|applicant|portal/i.test(url)) {
      links.careerPortalUrl = url;
    }
  }

  return links;
}
```

### Application ID Extraction

```typescript
// lib/extraction/ids.ts
export function extractApplicationIds(body: string): {
  applicationId?: string;
  requisitionId?: string;
  candidateId?: string;
} {
  const ids = {};

  // Pattern: Application ID: xxxxxx
  const appIdMatch = body.match(/application\s*(?:id|number|ref):\s*([A-Z0-9-]+)/i);
  if (appIdMatch) ids.applicationId = appIdMatch[1];

  // Pattern: Requisition ID: xxxxxx
  const reqIdMatch = body.match(/requisition\s*(?:id|number|ref):\s*([A-Z0-9-]+)/i);
  if (reqIdMatch) ids.requisitionId = reqIdMatch[1];

  // Pattern: Candidate ID: xxxxxx
  const candIdMatch = body.match(/candidate\s*(?:id|number|ref):\s*([A-Z0-9-]+)/i);
  if (candIdMatch) ids.candidateId = candIdMatch[1];

  return ids;
}
```

---

## Phase 4: Merge & Deduplication

**Duration:** 1 sprint

### Application Matching Algorithm

```typescript
// lib/database/application-matcher.ts
export function findMatchingApplication(
  parsed: ParseResult,
  existingApps: JobApplication[],
): JobApplication | null {
  const candidates: Array<{ app: JobApplication; score: number }> = [];

  for (const app of existingApps) {
    let score = 0;

    // TIER 1: Application ID match (exact, weight 100)
    if (parsed.application_id && app.application_id === parsed.application_id) {
      return app; // Definite match
    }

    // TIER 2: Company + Role fuzzy match (weight 80)
    if (fuzzyMatch(parsed.company, app.company) > 0.85) {
      score += 50;
      if (parsed.role && fuzzyMatch(parsed.role, app.role || '') > 0.7) {
        score += 30;
      }
    }

    // TIER 3: Gmail thread match (weight 60)
    if (parsed.gmail_thread_id === app.gmail_thread_id) {
      score += 60;
    }

    // TIER 4: Time proximity (weight 40)
    if (score > 0 && isWithinDays(new Date(app.applied_date || ''), 90)) {
      score += 20;
    }

    if (score > 0) {
      candidates.push({ app, score });
    }
  }

  // Return highest-scoring match if score > threshold
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    if (candidates[0].score > 60) {
      return candidates[0].app;
    }
  }

  return null;
}

function fuzzyMatch(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  // Implement Levenshtein distance or similar
  return calculateSimilarity(a, b);
}
```

---

## Phase 5: Testing & Validation

**Duration:** 1 sprint

### Test Corpus

Create `tests/fixtures/emails/`:
```
├── indeed/
│   ├── application-confirmation.eml
│   ├── withdrawal-confirmation.eml
│   └── invalid-format.eml
├── greenhouse/
│   ├── move-forward.eml
│   ├── rejection.eml
│   └── offer.eml
├── generic/
│   ├── ambiguous-recruiter.eml
│   ├── forwarded-message.eml
│   └── high-confidence.eml
└── edge-cases/
    ├── non-recruitment-insurance.eml
    ├── non-recruitment-banking.eml
    └── non-recruitment-marketing.eml
```

### Accuracy Testing

```typescript
// tests/parser.test.ts
describe('Deterministic Parser', () => {
  it('should parse Indeed applications with 95%+ accuracy', async () => {
    const emails = loadFixtures('indeed/*');
    const results = emails.map(email => parser.parse(email));
    const accuracy = calculateAccuracy(results, emails);
    expect(accuracy).toBeGreaterThan(0.95);
  });

  it('should reject non-recruitment emails', async () => {
    const nonRecruitmentEmails = loadFixtures('edge-cases/non-recruitment-*');
    const results = nonRecruitmentEmails.map(email => classifier.classify(email));
    expect(results.every(r => !r.isRecruitment)).toBe(true);
  });

  it('should achieve 87%+ accuracy without AI', async () => {
    const allEmails = loadFixtures('**/*.eml');
    const results = allEmails.map(email => parser.parse(email));
    const accuracy = calculateAccuracy(results, allEmails);
    expect(accuracy).toBeGreaterThan(0.87);
  });
});
```

---

## Phase 6: Monitoring & Observability

**Duration:** 1 sprint

### Confidence Distribution Tracking

```typescript
// lib/pipeline/monitor.ts
export class ConfidenceMonitor {
  private buckets = {
    highConfidence: 0,      // 0.9-1.0
    mediumConfidence: 0,    // 0.7-0.89
    lowConfidence: 0,       // 0.5-0.69
    veryLowConfidence: 0,   // <0.5
  };

  record(confidence: number) {
    if (confidence >= 0.9) this.buckets.highConfidence++;
    else if (confidence >= 0.7) this.buckets.mediumConfidence++;
    else if (confidence >= 0.5) this.buckets.lowConfidence++;
    else this.buckets.veryLowConfidence++;
  }

  getDistribution() {
    const total = Object.values(this.buckets).reduce((a, b) => a + b, 0);
    return {
      high: (this.buckets.highConfidence / total * 100).toFixed(1) + '%',
      medium: (this.buckets.mediumConfidence / total * 100).toFixed(1) + '%',
      low: (this.buckets.lowConfidence / total * 100).toFixed(1) + '%',
      veryLow: (this.buckets.veryLowConfidence / total * 100).toFixed(1) + '%',
    };
  }
}
```

---

## Migration Checklist

- [ ] Add configuration layer
- [ ] Disable AI by default (set `useDeterministicOnly: true`)
- [ ] Expand parser registry to 14+ platforms
- [ ] Implement advanced extraction (dates, links, IDs)
- [ ] Build application matcher
- [ ] Set up test corpus and accuracy benchmarks
- [ ] Add monitoring/telemetry
- [ ] Run validation against 1000+ emails
- [ ] Document API changes
- [ ] Deploy with feature flag (AI toggle)
- [ ] Monitor production metrics for 1 week
- [ ] Remove AI from critical path (make it truly optional)

---

## Success Criteria

✅ 87%+ accuracy without AI (deterministic only)
✅ < 100ms parsing time per email
✅ Zero external API calls for core parsing (optional only)
✅ 14+ platform parsers with full coverage
✅ <0.1% false positives on non-recruitment filtering
✅ 99%+ deduplication accuracy
✅ Easy-to-add new parser format (single file)
