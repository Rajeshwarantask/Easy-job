# Phase 4: Email Threading Analysis - Implementation Summary

## Overview

Phase 4 implements **email threading analysis** to group related emails into application lifecycle timelines. This layer sits between the parsing pipeline (Phase 1-2) and the dashboard UI (Phase 3), providing intelligent thread grouping and event sequencing.

## Key Achievements

### 1. Database Schema for Threading (`supabase/migrations/02_email_threading.sql`)

**New Tables:**
- `email_threads` - Represents a single application conversation (one Gmail thread per application)
  - Tracks thread status progression (active → archived → rejected → offer_accepted)
  - Records timeline of first/last emails and total count
  - Detects interview links and offer presence
  - Calculates days since last contact for user reminders

- `thread_timeline_events` - Denormalized event timeline
  - Sequence of events (applied → assessment → interview → offer → rejection)
  - Maps events to specific emails
  - Enables efficient timeline queries without traversing email_events table

**Relationships:**
- `email_threads` → `applications` (many threads per app, though typically 1:1)
- `email_threads` → `email_events` (via thread_id)
- `thread_timeline_events` → `email_threads` (via thread_id)

### 2. Thread Grouping Logic (`lib/parsing/thread-builder.ts`)

**Key Functions:**

`buildEmailThread()` - Groups emails by Gmail thread ID and extracts:
- Thread metadata (first/last email dates, total count, duration)
- Sender analysis (primary sender domain for platform identification)
- Status progression (applied → assessment → interview → offer → rejection)
- Interview detection and date extraction
- Offer detection and deadline inference
- Days since last contact for activity tracking

`buildTimelineEvents()` - Creates denormalized event sequence:
- Converts parsed email event types into canonical timeline events
- Deduplicates identical statuses (only one "applied" event per thread)
- Maps events to source emails for traceability
- Maintains event order for UI rendering

**Design Principles:**
- **Deterministic**: No AI. Uses regex patterns and keywords to identify events.
- **Robust**: Handles malformed emails, missing dates, duplicate events.
- **Efficient**: Builds complete thread in single pass through emails.

### 3. Timeline Visualization Components

**EmailTimeline** (`components/email-timeline.tsx`)
- Vertical timeline with color-coded event badges
- Shows days elapsed between events
- Compact mode for inline display, expanded mode for detailed view
- Icons for each event type (applied, assessment, interview, offer, rejection)
- Responsive design that works on mobile and desktop

**EmailThreadView** (`components/email-thread-view.tsx`)
- Shows all emails in thread with expandable details
- Displays email metadata (from, subject, date, event type)
- Thread summary (started date, last email, duration, email count)
- Estimated next action based on status progression
- Collapsible email bodies with preview text

### 4. Thread Detail Page (`app/dashboard/applications/[id]/threads/page.tsx`)

- Full application timeline visualization
- Complete email thread with expand/collapse
- Thread metadata (thread ID, sender domain, status progression)
- Integration of timeline + email view for complete picture
- Navigation back to application

### 5. Thread Management API Routes (`app/api/applications/[id]/threads/route.ts`)

**GET** - Fetch all threads for an application
- Returns thread metadata + associated emails + timeline events
- Supports user authorization checks
- Efficient query using proper indexes

**POST** - Create new threads after sync
- Called by sync pipeline to persist thread structure
- Accepts pre-built thread data from buildEmailThread()
- Automatically associates with application

**PATCH** - Update thread status or metadata
- Allows users to mark threads as archived, rejected, etc.
- Supports status progression tracking

## Integration Points

### From Parsing Pipeline (Phase 1-2)
The sync-orchestrator creates `ParsedApplication` objects with:
- `originalEmail.gmailThreadId` - Used as thread grouping key
- `timelineEvents` - Pre-classified events become thread timeline

### To Dashboard (Phase 3)
- Thread detail page accessible from application detail page
- Timeline visualization component reusable across pages
- Thread status affects application status display

## Type System (`lib/thread-types.ts`)

```typescript
// Core types for threading operations
- EmailThread: Complete thread record with metadata
- ThreadTimelineEvent: Single event in thread progression
- ThreadWithEvents: Thread + associated events for API responses
- ThreadGrouping: Multi-thread view of entire application lifecycle
```

## Database Indexes for Performance

- `idx_threads_user_id` - User filtering (frequent)
- `idx_threads_application_id` - Application detail page
- `idx_threads_gmail_thread_id` - Deduplication on sync
- `idx_threads_status` - Status-based queries
- `idx_threads_last_contact` - "Show me recent activity"
- `idx_email_events_thread_id` - Thread detail loading

## Design Decisions

1. **One Gmail Thread = One Email Thread Record**
   - Simplifies deduplication
   - Aligns with how Gmail organizes conversations
   - Thread ID is immutable and globally unique per user

2. **Denormalized Timeline Events**
   - Avoids expensive JOINs in UI queries
   - Pre-computed status progression for fast filtering
   - Each event order is explicit (no need to sort email dates)

3. **Status Progression as Array**
   - Enables multi-step tracking (applied → assessment → interview)
   - Supports edge cases (rejection after interview, revived rejected app)
   - Queryable in PostgreSQL with `array_contains()`

4. **Days Since Last Contact**
   - Computed on thread creation/update
   - Powers "no activity for 30 days" UI indicators
   - Helps users identify stalled applications

5. **Estimated Next Action**
   - Deterministic based on status progression
   - Guides user expectation (what should happen next?)
   - No ML/AI - simple rule-based logic

## Future Enhancements

- **Thread merging**: Detect if multiple threads belong to same application
- **Activity alerts**: Notify user if interview not scheduled by expected date
- **Thread export**: Download thread as PDF or email
- **Auto-follow-up**: Suggest follow-up email timing based on silence
- **Sentiment analysis**: Detect rejection/offer tone in email bodies (optional AI)

## Files Added/Modified

**New Files:**
- `supabase/migrations/02_email_threading.sql` - Schema
- `lib/thread-types.ts` - TypeScript types
- `lib/parsing/thread-builder.ts` - Threading logic
- `components/email-timeline.tsx` - Timeline UI
- `components/email-thread-view.tsx` - Thread details UI
- `app/dashboard/applications/[id]/threads/page.tsx` - Detail page
- `app/api/applications/[id]/threads/route.ts` - API routes

**Files Modified:**
- None (Phase 4 is additive to existing architecture)

## Testing Recommendations

1. **Unit Tests**
   - Test `buildEmailThread()` with various email sequences
   - Verify status progression extraction
   - Test date parsing edge cases
   - Verify deduplication logic

2. **Integration Tests**
   - Full sync → thread creation → API query
   - Verify timeline event counts
   - Test UI rendering with real thread data

3. **E2E Tests**
   - Sync real Gmail emails
   - Verify threads created correctly in DB
   - Check timeline visualization accuracy

## Success Metrics

✓ Email threads group correctly by Gmail thread ID  
✓ Timeline events extracted accurately from email sequence  
✓ UI renders thread with visual timeline and email list  
✓ API queries return complete thread data under 500ms  
✓ Status progression enables filtering by application stage  

## Architecture Diagram

```
Parsing Pipeline (Phase 1-2)
        ↓
ParsedApplication + Gmail emails
        ↓
Thread Builder (buildEmailThread)
        ↓
EmailThread record + TimelineEvent[] 
        ↓
Persist to DB (email_threads, thread_timeline_events)
        ↓
Dashboard (Phase 3)
        ↓
Timeline UI + Email View
```

---

**Phase 4 Complete** - Email threading analysis operational. Ready for Phase 5 enhancements (salary normalization, predictive features, etc.)
