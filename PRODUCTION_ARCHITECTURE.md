# Production-Grade Parsing Architecture

## The 10 Architectural Improvements

### 1. Data-Driven Pipeline Configuration

**Problem:** Pipeline hardcoded stages. Reordering or disabling required code changes.

**Solution:** `pipeline-config.ts` defines stages as data.

```typescript
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  stages: [
    { stage: metadataExtractor, enabled: true, required: true },
    { stage: classifier, enabled: true, required: false },
    { stage: extractor, enabled: true, required: true },
  ]
};
```

**Benefits:**
- Disable stages without code changes
- Reorder pipeline dynamically
- Load config from database at runtime
- A/B test different stage orderings

### 2. Unified Pipeline Context

**Problem:** Stages had different signatures, passed different arguments around.

**Solution:** Single `PipelineContext` object that all stages read/write.

```typescript
interface PipelineContext {
  rawEmail: { ... };
  normalizedEmail?: NormalizedEmail;
  metadata?: EmailMetadata;
  classification?: DocumentClassification;
  extractedFields?: ExtractedFields;
  // ... all stage outputs
  logs: [];
}
```

**Benefits:**
- Consistent stage interface
- Easy to pass context through pipeline
- Automatic versioning/auditing via logs
- Type-safe access to stage outputs

### 3. Strategy Pattern for Extractors

**Problem:** One monolithic extractor that tried to handle all ATS platforms.

**Solution:** Pluggable extraction strategies.

```typescript
interface ExtractionStrategy {
  platformId: string; // "indeed", "greenhouse", "workday"
  canHandle(context): boolean;
  extract(context): ExtractedFields;
  getPriority(context): number;
}

// Adding new ATS support:
class WorkdayExtractionStrategy extends BaseExtractionStrategy { ... }
registry.register(new WorkdayExtractionStrategy());
```

**Benefits:**
- New ATS support = new strategy class
- No changes to core pipeline
- Easy to test each strategy independently
- Each strategy is <200 lines of focused code

### 4. Validation Never Modifies Data

**Problem:** Validation was fixing data instead of just checking it.

**Solution:** Validation only answers questions.

```typescript
interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  criticalIssues: string[];
  confidence: number;
  fieldConfidences: Record<string, number>;
}

// Validation NEVER modifies fields
// If data needs fixing → that's resolver's job
```

**Benefits:**
- Clear separation of concerns
- Debugging is easier (validation only observes)
- Validation rules are immutable
- Can replay validation with same result

### 5. Builder is Immutable

**Problem:** Builder was modifying previous stages' outputs.

**Solution:** Builder creates new ParsedApplication from inputs, never mutates.

```typescript
// WRONG:
builder.application.company = resolved.company;

// RIGHT:
const application = new ParsedApplication({
  company: resolved.company,
  role: resolved.role,
  // ...
});
```

**Benefits:**
- Easier debugging (no mutations)
- Can trace where each field came from
- Thread-safe
- Easier to version/snapshot

### 6. Standardized Stage Results

**Problem:** Stages returned different shapes. Orchestrator had special logic for each.

**Solution:** Every stage returns identical `StageResult<T>`.

```typescript
interface StageResult<T> {
  success: boolean;
  data: T;
  confidence: number;
  warnings: string[];
  metrics: {
    processingTimeMs: number;
    rulesApplied: string[];
  };
}
```

**Benefits:**
- Pipeline orchestrator is simple (no special cases)
- Automatic metrics collection
- Easy to implement dashboards
- Debugging is consistent

### 7. Independent Testing

**Problem:** Stages required Gmail API, database, complex setup.

**Solution:** Stages accept JSON, return JSON, no side effects.

```typescript
// Test a stage in isolation:
const context = createTestContext(TEST_EMAILS.indeedConfirmation);
const result = await metadataExtractor.execute(context);

// No setup required. No databases. No APIs.
// Just JSON in, JSON out.
```

**Benefits:**
- Fast test suite
- Can be run offline
- Easy to add regression tests
- Snapshot testing possible

### 8. Rule Registry (Centralization)

**Problem:** Regexes scattered across files. Hard to update rules.

**Solution:** `rule-registry.ts` centralizes all rules.

```typescript
export const COMPANY_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "email_domain",
    pattern: /@([a-z0-9-]+)\.com/i,
    confidence: 0.95,
    priority: 100,
  },
  // ... more rules
];

// Use rules:
const rules = ruleRegistry.getCompanyRules();
```

**Benefits:**
- Update rules without touching code
- Easy to version rules
- Can load rules from database
- A/B test different rule sets

### 9. Versioning

**Problem:** Can't tell which parser generated which output.

**Solution:** Every output includes versions.

```typescript
{
  parserVersion: "3.0.0",
  pipelineVersion: "3.0.0",
  ruleVersion: "2026-08-04",
  metadata: {
    extractedFields: { ... },
    validation: { ... }
  }
}
```

**Benefits:**
- Debug production issues
- Replay with old rules
- Track accuracy by version
- Gradual rollouts possible

### 10. The Compiler Mental Model

**Mental Model:**

```
Source Code        → Lexer              → Parser             → Semantic
(Raw Email)          (Normalize)          (Extract)            Analysis
                                                              (Validation)
     ↓                  ↓                   ↓                    ↓
[Raw Gmail]    →  [Normalized Email] → [Extracted Fields] → [Valid?]

     ↓                                                          ↓
     └─────────────────────────────────────────────────────────┘
                              ↓
                    Optimization / Resolution
                    (Pick best values)
                              ↓
                    Identity Resolution
                    (Merge duplicates)
                              ↓
                    State Analysis
                    (Track machine state)
                              ↓
                    Timeline Generation
                    (Create event sequence)
                              ↓
                    Application Builder
                    (Assemble AST → ParsedApplication)
                              ↓
                        Executable
                      (Database ready)
```

**Why this helps:**
- Each layer has ONE responsibility
- Clear data flow
- Easy to add new layers (insert between existing)
- Language/platform implementation details don't leak

## File Structure

```
lib/parsing/
├── pipeline-context.ts          (Unified context object)
├── stage.ts                     (Stage interface)
├── pipeline-config.ts           (Data-driven configuration)
├── rule-registry.ts             (Centralized rules)
├── production-orchestrator.ts   (Main orchestrator)
├── state-rules.ts               (State machine rules as data)
├── strategies/
│   └── extractor-strategy.ts    (Strategy pattern for ATS)
└── __tests__/
    └── test-utils.ts            (Testing utilities)
```

## How to Add New ATS Support

1. Create new strategy:
```typescript
class OracleExtractionStrategy extends BaseExtractionStrategy {
  platformId = "oracle";
  canHandle(context) { /* detect Oracle emails */ }
  extract(context) { /* extract Oracle-specific fields */ }
}
```

2. Register it:
```typescript
registry.register(new OracleExtractionStrategy());
```

3. Done! No changes to pipeline, orchestrator, or other code.

## How to Update Rules

1. Edit `rule-registry.ts`
2. Add/update `COMPANY_EXTRACTION_RULES`, `ROLE_EXTRACTION_RULES`, etc.
3. Deploy
4. Done! Rules take effect immediately.

## How to Disable a Stage

1. Edit `pipeline-config.ts`
2. Set `enabled: false` for that stage
3. Deploy
4. Done! Pipeline skips that stage.

## Metrics & Versioning

Every parsed application includes:
- `parserVersion`: Which version of parser ran
- `pipelineVersion`: Which pipeline version
- `ruleVersion`: Which rules were active
- `metadata.validation.confidence`: Overall confidence

Use these to track accuracy trends, identify bugs, and manage rollouts.

## Testing Strategy

1. Unit test each stage independently (JSON in/out)
2. Integration test full pipeline with snapshot tests
3. Add real recruitment emails as regression tests
4. Monitor accuracy metrics in production
5. A/B test new strategies or rules

## Next Steps

The architecture is now production-ready. Focus on:

1. **Test Corpus**: Collect 100+ real recruitment emails
2. **Accuracy Metrics**: Track field extraction accuracy
3. **Performance Benchmarks**: Monitor pipeline latency
4. **Rule Refinement**: Iterate on extraction rules
5. **Strategy Implementation**: Complete ATS-specific strategies

The architecture won't need redesigning. Only implementations change.
