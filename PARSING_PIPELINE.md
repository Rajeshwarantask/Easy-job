# Parsing Pipeline Architecture

## Overview
Composable, stage-based pipeline. Each stage has ONE responsibility: input → output.

## Pipeline Stages

1. **Input Normalization** (mime-decoder + html-cleaner)
   - Converts any email format to `NormalizedEmail`

2. **Metadata Extraction** (metadata-extractor.ts)
   - Extracts sender, platform, links, urgency signals
   - Classifier needs full context before deciding

3. **Recruitment Classification** (recruitment-filter)
   - Filters non-job emails

4. **Document Classification** (document-classifier)
   - Identifies email type: confirmation, assessment, interview, offer, rejection, etc.
   - Uses metadata + content

5. **Information Extraction** (parsers)
   - Extracts fields: company, role, salary, location, recruiter, links, dates
   - Each field has confidence score + source

6. **Field Resolution** (specialized resolvers)
   - When multiple extractors produce different values, picks winner
   - CompanyResolver, RoleResolver, DateResolver, etc.
   - Strategy: highest confidence + consistency checks

7. **Validation** (validation)
   - Checks if facts make sense together

8. **Identity Resolution** (identity-resolver)
   - Is this a new application or update to existing?
   - Signals: thread ID (99%) > recruiter (95%) > company+role (7d: 92%)
   - Works over entire sync context

9. **State Engine** (state-engine-v2.ts)
   - Maps document type to application state
   - Rules in `state-rules.ts` (data), not code
   - Validates state transitions

10. **Timeline Builder** (timeline-builder)
    - Converts facts to timeline events

11. **Application Builder** (application-builder.ts)
    - Assembles final `ParsedApplication` object
    - Single responsibility: assemble + return

## Key Principles

- **Stage Interface**: Every stage implements `run(input) -> StageOutput<output>`
- **Metadata Output**: Every stage outputs `{data, confidence, reason, source, warnings, processingTimeMs}`
- **No God Objects**: Each stage knows only input/output, not whole system
- **Data-Driven Rules**: State transitions in `state-rules.ts`, not hardcoded
- **Composable**: Add stages without modifying pipeline logic

## Files

```
lib/parsing/
├── pipeline.ts                 # Stage interface + types
├── pipeline-orchestrator.ts    # Composable pipeline runner
├── state-rules.ts              # Data: state rules, transitions
├── stages/
│   ├── metadata-extractor.ts
│   ├── company-resolver.ts     # Specialized resolver
│   ├── state-engine-v2.ts      # Data-driven state machine
│   └── application-builder.ts  # Final assembly
```

## Debug Info

Every stage exposes:
- `confidence`: How sure are we? (0-1)
- `reason`: Why this output?
- `source`: Which logic produced it?
- `warnings`: What went wrong?
- `processingTimeMs`: How long did this take?

Perfect for debugging parsing failures.

## Example: Adding New ATS Platform

1. Add new patterns to metadata-extractor.ts
2. Add new parser to parsers/ directory
3. Pipeline automatically uses it

No changes to orchestrator, resolvers, or builder.
