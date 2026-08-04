# JobTrail - Complete Architecture Overview

## Project Phases Status

| Phase | Name | Status | Focus |
|-------|------|--------|-------|
| 1-2 | Parsing Pipeline | ✅ Complete | Deterministic email parsing for 6 ATS platforms |
| 3 | Dashboard & Persistence | ✅ Complete | UI for viewing/editing applications with confidence scores |
| 4 | Email Threading | ✅ Complete | Group emails into application lifecycles |
| 5 | Advanced Features | 📋 Planned | Salary normalization, predictive analytics, taxonomy |

## System Architecture

```
User Browser
    ↓
Next.js 16 App Router
├── /dashboard - Main UI
│   ├── /applications - Applications list
│   ├── /applications/[id] - Application detail + threads
│   └── /applications/[id]/threads - Thread visualization
├── /api/parsing/sync - Email sync endpoint
├── /api/applications - CRUD operations
├── /api/applications/[id]/threads - Thread management
└── /auth - Authentication

↓
Supabase Backend
├── PostgreSQL Database
│   ├── users - Auth users
│   ├── applications - Parsed job applications
│   ├── email_events - Raw emails from Gmail
│   ├── email_threads - Grouped email conversations
│   └── thread_timeline_events - Event sequences
├── Row-Level Security - User data isolation
└── Indexes - Performance optimization

↓
Gmail API
└── OAuth2 access → Email sync
```

## Data Flow

### 1. Email Sync Flow

```
User clicks "Sync Gmail"
    ↓
/api/parsing/sync (authenticated)
    ↓
Get Gmail access token from session
    ↓
Fetch emails from Gmail API
    ↓
For each email:
  ├─ Decode MIME structure
  ├─ Clean HTML → text
  ├─ Filter recruitment signals
  ├─ Detect ATS platform
  ├─ Run platform parser
  ├─ Validate & score confidence
  ├─ Enrich data (normalize, infer fields)
  ├─ Map to existing application (dedup)
  └─ Build timeline events
    ↓
Persist ParsedApplication objects
    ├─ Save to applications table
    ├─ Link to email_events
    └─ Create email_threads + timeline
    ↓
Return summary to UI
    ↓
Dashboard updates with new applications
```

### 2. Application View Flow

```
User views dashboard
    ↓
/api/applications (paginated, filtered)
    ↓
Query DB: applications + confidence scores
    ↓
UI renders list with:
  ├─ Company, role, status, confidence
  ├─ Color-coded badges by stage
  └─ Starred/archived indicators
    ↓
User clicks application
    ↓
/dashboard/applications/[id]
    ↓
Load application detail + recent emails
    ↓
Display:
  ├─ Core fields with override capability
  ├─ Confidence badges
  ├─ Email thread timeline
  └─ Action buttons (star, archive, view in Gmail)
```

### 3. Threading Flow

```
After sync persists emails
    ↓
Thread builder groups by gmail_thread_id
    ↓
Extract thread metadata:
  ├─ Status progression
  ├─ Sender domain/ATS platform
  ├─ Interview dates
  ├─ Offer presence
  └─ Days since last contact
    ↓
Create thread_timeline_events:
  ├─ Applied → Assessment → Interview → Offer
  └─ Each event linked to source email
    ↓
Persist email_threads + thread_timeline_events
    ↓
UI queries via /api/applications/[id]/threads
    ↓
Render timeline visualization
    ├─ Vertical timeline with event badges
    ├─ Email list with expand/collapse
    └─ Thread metadata panel
```

## Core Libraries & Dependencies

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting
- **lucide-react** - Icons
- **shadcn/ui** - Component library (installed but minimal usage)

### Backend
- **Supabase Client** - PostgreSQL + Auth
- **Zod** (planned) - Schema validation
- **Cheerio** (for HTML parsing if needed)

### APIs
- **Gmail API v1** - OAuth2 email access
- **NextAuth.js v5** - Session management

## Database Schema

### Core Tables

**users**
- Auth table (managed by Supabase/NextAuth)

**applications**
- Parsed job applications
- Unique per (user_id, company_normalized, role_normalized, thread_id)
- Indexes: user_id, status, created_at, starred, company

**email_events**
- Raw emails from Gmail
- Foreign key: applications.id
- Tracks: from, subject, date, parsed event_type, confidence

**email_threads**
- Grouped email conversations
- One per Gmail thread + application
- Tracks: status progression, timeline, sender domain, next action

**thread_timeline_events**
- Denormalized event sequence
- Pre-computed for fast UI queries
- Foreign key: email_threads.id

### Row-Level Security
- `applications` - Visible only to owner (user_id)
- `email_events` - Visible only to owner
- `email_threads` - Visible only to owner

## Parsing Architecture

### Platform Detectors
1. **Indeed Parser** - `lib/parsing/parsers/indeed-parser.ts`
   - Domain: indeed.com
   - Extracts: company, role, application link
   - Confidence: 0.8-0.95

2. **Greenhouse Parser** - `lib/parsing/parsers/greenhouse-parser.ts`
   - Domain: greenhouse.io
   - Extracts: role, company, interview details
   - Confidence: 0.85-0.95

3. **Workday Parser** - `lib/parsing/parsers/workday-parser.ts`
   - Domain: myworkday.com
   - Extracts: company, role, requisition ID, application ID
   - Confidence: 0.75-0.90

4. **Lever Parser** - `lib/parsing/parsers/lever-parser.ts`
   - Domain: lever.co
   - Extracts: role, company, interview link
   - Confidence: 0.75-0.90

5. **Ashby Parser** - `lib/parsing/parsers/ashby-parser.ts`
   - Domain: ashby.io
   - Extracts: role, company, stage info
   - Confidence: 0.75-0.90

6. **Generic Parser** - `lib/parsing/parsers/generic-parser.ts`
   - Fallback for unknown ATS
   - Regex patterns for common fields
   - Confidence: 0.4-0.6

### Parsing Pipeline Stages

```
MIME Decode → HTML Clean → Recruitment Filter → Platform Detect → Platform Parser
     ↓              ↓               ↓                   ↓                ↓
Headers       Clean text       Score signal      Platform ID      Extracted fields
Body parts    Links            Confidence        Metadata          + confidence
```

### Field Extractors

Located in `lib/parsing/field-extractors/`:

- **salary-extractor.ts** - Finds salary ranges, hourly rates
- **interview-link-extractor.ts** - Detects Zoom, Teams, Google Meet links
- **datetime-extractor.ts** - Parses interview dates and times

## Confidence Scoring

Every parsed field has a confidence score (0-1):
- 0.9-1.0: Very confident (exact domain match, structured data)
- 0.7-0.9: Confident (platform-specific patterns matched)
- 0.5-0.7: Uncertain (heuristic matching, inferred from context)
- <0.5: Low confidence (regex fallback, user review recommended)

Scores inform:
- UI display (color coding: red/yellow/green)
- User override prompts (low confidence → show override modal)
- Filtering (can hide low-confidence applications)
- Analytics (track accuracy by parser + platform)

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Start OAuth flow
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Current session

### Applications
- `GET /api/applications` - List applications (paginated, filtered)
- `GET /api/applications/[id]` - Get single application
- `PATCH /api/applications/[id]` - Update application (notes, status, overrides)
- `DELETE /api/applications/[id]` - Archive application

### Parsing & Sync
- `POST /api/parsing/sync` - Sync Gmail emails (main endpoint)
- `POST /api/parsing/parse` - Parse single email (testing)
- `GET /api/sync/status` - Get last sync time, counts

### Threading
- `GET /api/applications/[id]/threads` - Get all threads + events
- `POST /api/applications/[id]/threads` - Create thread
- `PATCH /api/applications/[id]/threads` - Update thread status

## UI Components

### Layout
- `app/dashboard/layout.tsx` - Main dashboard wrapper with nav

### Pages
- `app/dashboard/page.tsx` - Home dashboard (stats, quick actions)
- `app/dashboard/applications/page.tsx` - Applications list
- `app/dashboard/applications/[id]/page.tsx` - Application detail
- `app/dashboard/applications/[id]/threads/page.tsx` - Thread timeline

### Components
- `applications-table.tsx` - Reusable applications list table
- `confidence-badge.tsx` - Confidence score display
- `field-override-modal.tsx` - Modal for correcting low-confidence fields
- `editable-field.tsx` - Inline field editor with confidence
- `email-timeline.tsx` - Timeline visualization
- `email-thread-view.tsx` - Thread with expandable emails
- `sync-status.tsx` - Sync button with feedback

## Environment Variables

### Required for Development

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
NEXTAUTH_SECRET=...  # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Gmail OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Optional Features (not yet implemented)
- `SENTRY_DSN` - Error tracking
- `STRIPE_API_KEY` - Payments
- `RESEND_API_KEY` - Email notifications

## Performance Considerations

### Database Optimization
- Indexes on frequently filtered columns
- Denormalized thread_timeline_events (avoid N+1 queries)
- Pagination on applications list (max 50/page)

### API Caching
- Gmail API results cached in memory (5 min)
- Application list cached client-side with SWR

### UI Optimization
- Lazy load emails in thread view
- Timeline events rendered incrementally
- Collapsible email bodies to reduce DOM size

## Security

### Data Protection
- Row-level security on all user data
- Session-based authentication via NextAuth
- OAuth2 for Gmail (no storing passwords)
- Parameterized queries (Supabase handles this)

### Input Validation
- All API inputs validated before processing
- Email content sanitized (HTML cleaned)
- User overrides validated for field type

### Rate Limiting
- Gmail API calls rate-limited per user
- Sync endpoint limited to 1 per minute per user (future)

## Monitoring & Debugging

### Logging
- `console.log("[v0] message")` - v0-specific logs for debugging
- Server-side logs visible in Vercel dashboard
- Client-side errors logged to browser console

### Debug Endpoints (future)
- `/api/parsing/parse?email=...` - Test parser with sample email
- `/api/debug/threads?app_id=...` - Inspect thread structure

## Future Enhancement Areas

### Phase 5 Planned
- **Salary Normalization** - Convert all salaries to USD/annual
- **Role Taxonomy** - Standardize "Software Engineer", "SWE", "Dev" → canonical role
- **Predictive Scoring** - Estimate success probability based on timeline
- **Interview Prep** - Track prep time, suggest study materials
- **Follow-up Automation** - Suggest follow-up email timing

### Beyond Phase 5
- **Team/Company Sharing** - Collaborative hiring tracking
- **Analytics Dashboard** - Conversion rates, offer/rejection ratios
- **Calendar Integration** - Sync interviews to Google Calendar
- **Salary Negotiation Tool** - Market rate comparison
- **Mobile App** - React Native for iOS/Android

---

**Architecture Version**: 1.0 (Phases 1-4 Complete)  
**Last Updated**: 2024  
**Status**: Production Ready
