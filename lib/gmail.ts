import { google } from "googleapis";
import {
  findOrCreateJob,
  createEmailEvent,
} from "./supabase-db";
import { parseEmailWithAI, PARSER_VERSION, type ParsedEmail, AI_DISABLED } from "./email-parser";
import { parsePlatformSpecific } from "./ats-parsers";
import { isRecruitmentEmail, extractCompanyFromDomain } from "./recruitment-classifier";
import { isValidCompany } from "./generic-regex-parser";
import { extractWithLayeredPipeline } from "./extraction-layers";
import { buildGmailQuery, type DateRangeType } from "./gmail-query-builder";
import { EmailTracer, PipelineTracer } from "./email-tracer";
import { PLATFORMS, detectPlatform, extractStructuredFields, type ExtractedFields } from "./extractors";
import { eventTypeToStatus } from "./normalize";
import { resolveApplications, fuzzyMatchApplications, type ParsedEmailRecord } from "./application-resolver";
import { createLogger } from "./logger";

const log = createLogger("Pipeline");

// ─────────────────────────────────────────────
// BODY TEXT EXTRACTION
// ─────────────────────────────────────────────

// Mirrors googleapis' Schema$MessagePart shape (fields may be null), so the
// Gmail payload can be passed in directly without casting.
interface GmailMessagePart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailMessagePart[] | null;
}

/**
 * Recursively extracts plain text from a Gmail message payload.
 * Prefers text/plain, falls back to stripping HTML from text/html.
 */
function extractBodyText(payload?: GmailMessagePart): string {
  if (!payload) return "";

  // Direct body on this part
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (payload.mimeType === "text/plain") {
      return decoded;
    }
    if (payload.mimeType === "text/html") {
      // Strip HTML tags for basic text extraction
      return decoded
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain") {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    // Fall back to text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html") {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    // Recurse into nested multiparts
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith("multipart/")) {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
  }

  return "";
}

// ─────────────────────────────────────────────
// BLOCKLISTS — emails matching these are skipped
// ─────────────────────────────────────────────

/** Sender domains/names that are never job-related */
const BLOCKED_SENDERS = [
  "openai.com", "chatgpt.com",
  "github.com", "gitlab.com",
  "netflix.com", "spotify.com",
  "amazon.com", "amazon.co",
  "google.com", "youtube.com",
  "apple.com", "icloud.com",
  "microsoft.com", "live.com", "outlook.com",
  "twitter.com", "x.com",
  "facebook.com", "instagram.com", "meta.com",
  "tiktok.com",
  "medium.com", "substack.com",
  "producthunt.com",
  "discord.com", "slack.com",
  "nytimes.com", "techcrunch.com",
  "notion.so", "airtable.com",
  "zoom.us", "calendly.com",
];

/** Subject patterns that indicate marketing / product / newsletter content */
const BLOCKED_SUBJECT_PATTERNS = [
  /new (image|photo|video|look|style|design)/i,  // Allow "new feature" — could be job-related
  /just dropped/i,
  /try (a|the|our|it) (new|now|free|today)/i,
  /your (next|new|daily|weekly|monthly) (look|digest|newsletter|summary|tip)/i,  // Keep "update" — might be job update
  /\d+% off/i,
  /unsubscribe/i,
  /verify your email/i,
  /confirm your (email|account|subscription)/i,
  /password (reset|change|update)/i,
  /security alert/i,
  /invoice #/i,
  /receipt for/i,
  /order (confirmed|shipped|delivered)/i,
  /getting started with/i,
  /tips for (using|getting|making)/i,
  /product (announcement|launch)/i,  // Allow "product update" — could be job status
  /newsletter/i,
  // Removed: /welcome to (your|our|the)/i — job offers say this
  // Removed: /re:\s*(re:|fw:|fwd:)/i — legitimate forwarded recruiter threads
];

/** Snippet / body patterns that indicate marketing / product content */
const BLOCKED_SNIPPET_PATTERNS = [
  /unsubscribe/i,
  /view (in|this) (browser|email|app)/i,
  /you.re receiving this (email|message|notification) because you (signed up|subscribed|opted)/i,
  /manage (your )?(email |notification )?preferences/i,
  /this email was sent to you by/i,
  /create (something|it|your)/i,   // creative tool ads
  /start creating/i,
  /try (for )?free/i,
  /limited time offer/i,
  /sale ends/i,
  /exclusive (deal|offer|discount)/i,
  /shop now/i,
];

// ─────────────────────────────────────────────
// JOB DETECTION PATTERNS (positive signals)
// ─────────────────────────────────────────────

const JOB_PATTERNS = {
  application: [
    /thank you for (applying|your application|registering|reaching out|your interest)/i,
    /application (received|submitted|confirmed|acknowledgment)/i,
    /registration (received|confirmed|successful)/i,
    /we.*(received|got) your (application|resume|cv|registration|profile|info)/i,
    /your application (to|for|at)/i,
    /application for (the )?(position|role|opening|vacancy|opportunity)/i,
    /successfully (applied|submitted your application|received your application)/i,
    /we.ll (review|be in touch|get back|evaluate)/i,
    /application is (under|being) (review|consideration|evaluated)/i,
    /currently reviewing your (profile|application|resume|candidacy|submission)/i,
    /campus (hiring|recruitment|drive|placement|program)/i,
    /hiring (process|program|drive)/i,
    /selection (process|procedure|criteria)/i,
    /further updates.*(next steps|selection|results)/i,
    /keep an eye on your email/i,
    /applied (to|for|at)/i,
    // Modern ATS language
    /your profile (remains|is now) under review/i,
    /application has progressed/i,
    /your candidacy/i,
    /review (of )?your (profile|candidacy|submission)/i,
    /thanks for (your interest|the time)/i,
    /interested in your (profile|background|experience)/i,
    /will be in touch/i,
    /let us know/i,
    /application status/i,
    /update on (your )?application/i,
    /application update/i,
    /candidate (profile|submission|status)/i,
    /talent (acquisition|team|pipeline)/i,
    /(hello|hi|greetings),?\s*(candidate|applicant|participant)/i,
    /keep you (posted|updated|informed)/i,
    /candidate (application|information|details)/i,
    /we.?re (reviewing|evaluating|assessing) your (profile|submission|candidacy)/i,
    /part of our (talent pool|hiring process|recruitment)/i,
    /next step(s)? (in |of )?your (journey|process|application)/i,
    /looking at (your|potential) (profile|candidacy|fit)/i,
    /(hiring|recruitment|talent) (team|department|manager)/i,
    /from (the |your )?(hiring|recruitment|talent) (team|department)/i,
    /you have (successfully )?applied/i,
  ],
  screening: [
    /initial (call|screen|screening|chat)/i,
    /recruiter (call|screen|chat|reach out)/i,
    /preliminary (interview|screen)/i,
    /30.?min(ute)? (call|chat|connect)/i,
    /quick (call|chat|connect) (with|to)/i,
    /talent (acquisition|recruiter)/i,
    /sourcing (call|screen)/i,
  ],
  interview: [
    /interview (invite|invitation|request|scheduled|confirmed|details)/i,
    /schedule.*(interview|call|meeting|session)/i,
    /(would|want to) (like to |love to )?(invite|schedule|set up)/i,
    /next step.*(interview|meet|technical|assessment)/i,
    /phone (screen|interview)/i,
    /technical (interview|round|screen)/i,
    /on.?site (interview|visit|loop)/i,
    /panel (interview|discussion)/i,
    /hiring (manager|committee|panel)/i,
    /second.*(interview|round|stage)/i,
    /final (interview|round|stage)/i,
    /zoom.*(interview|call|meet)/i,
    /google meet.*(interview)/i,
    /coding (interview|round)/i,
    // Indian ATS / campus patterns
    /shortlisted for (the )?(interview|next|further)/i,
    /(you have been|you.re|you are) shortlisted/i,
    /selected for (the )?(interview|next round|further)/i,
    /your (profile|candidature) (has been |is )?(shortlisted|selected|forwarded)/i,
    /moved to (the )?next (round|stage)/i,
    /proceed(ing)? to (the )?next (round|stage)/i,
    /congratulations.*(shortlisted|selected|interview)/i,
    /pleased to (inform|let you know).*(shortlisted|selected|interview)/i,
    /we are pleased to inform/i,
    /teams meeting/i,
    /please join the (meeting|call|interview)/i,
    /confirm(ed)? for.*(interview|technical|round)/i,
    // Modern ATS — candidate progression signals
    /your profile.*next step/i,
    /move forward.*interview/i,
    /interview .*(scheduled|planned|coming)/i,
    /candidate.*next round/i,
    /interview round/i,
    /interview opportunity/i,
    /interview slot/i,
    /speak (with|to|further)/i,
    /have you (available|free).*interview/i,
    /availability.*interview/i,
    /meet (with|our team)/i,
    /like to (know|learn|understand) more.*background/i,
    /move forward.*next stage/i,
    /pass.*first (round|stage)/i,
    /passed.*screening/i,
    /invite.*conversation/i,
  ],
  assessment: [
    /coding (challenge|test|exercise|problem)/i,
    /technical (assessment|test|task|exercise)/i,
    /take.?home (assignment|project|test|challenge)/i,
    /online (assessment|test|evaluation)/i,
    /hackerrank|codility|leetcode|codesignal|hackerearth/i,
    /skills? (assessment|test|evaluation)/i,
    /assignment (for|to complete)/i,
    /complete (the|a|this) (task|test|assignment|challenge)/i,
    // Modern ATS assessment language
    /please complete.*(assessment|challenge|assignment|evaluation)/i,
    /assessment.*link/i,
    /test link/i,
    /evaluation.*(link|ready|waiting)/i,
    /challenge (?:is )?ready/i,
    /begin (the|your).*(test|assessment|challenge|assignment)/i,
    /need you to (complete|take|submit|do).*(assessment|test|challenge)/i,
    /evaluate your skills/i,
    /test your knowledge/i,
    /assessment (?:now|due|ready|open)/i,
    /score on (the )?assessment/i,
    /submit (the )?assessment/i,
  ],
  offer: [
    /offer (letter|of employment|package|details)/i,
    /pleased to (offer|extend|present)/i,
    /formal (offer|job offer)/i,
    /we.*(like|want|are pleased|excited) to offer you/i,
    /offer.*position/i,
    /compensation (package|details|offer)/i,
    /start date/i,
    /welcome (aboard|to the team)/i,   // genuine welcome
    /joining (date|us|the team)/i,
  ],
  rejection: [
    /unfortunately.*(position|role|application|candidate|move)/i,
    /regret to (inform|let|tell)/i,
    /not (moving|proceeding|progressing) forward/i,
    /decided (not to|to move forward with other)/i,
    /(position|role) has been filled/i,
    /will not be (moving|continuing|proceeding)/i,
    /other candidates (who|were|more)/i,
    /not selected/i,
    /does not meet/i,
    /won.t be (moving|proceeding)/i,
    /no longer (considering|moving)/i,
    /application (was|has been) (unsuccessful|declined)/i,
    // Indian patterns
    /not (be able to |)(take|move) your candidature forward/i,
    /unable to (proceed|move forward) with your/i,
    /will not be (shortlisting|progressing|proceeding)/i,
    /your profile (does not|doesn.t) (match|meet|fit)/i,
    /not shortlisted/i,
    /candidature (has been |was |is )?(rejected|declined|unsuccessful)/i,
    /we have (decided|chosen) to (move forward|proceed) with other/i,
    /after careful (consideration|review|evaluation)/i,
    /won.t be able to (proceed|move|take)/i,
  ],
};

// ─────────────────────────────────────────────
// CONFIDENCE SCORING — must exceed threshold
// ─────────────────────────────────────────────

/**
 * Regex parser confidence threshold. Lowered from 2.0 to 0.8 to prevent losing emails.
 * 
 * CRITICAL FIX: Modern ATS emails use subtle language that doesn't match hard keywords.
 * Better to process emails with low confidence and let Application Resolver filter
 * than to never even try to parse them.
 * 
 * 0.8 = Accept almost everything
 * AI parser has separate threshold (0.2) for gradual filtering
 */
const MIN_CONFIDENCE = 0.8;

/**
 * When a regex parse reaches this status confidence AND identifies a company,
 * we trust it and skip the AI call entirely. This is what collapses ~211 AI
 * calls down to only the genuinely ambiguous emails, keeping us under the
 * free-tier rate limit.
 */
const REGEX_SKIP_AI_THRESHOLD = 0.7;

function scoreEmail(from: string, subject: string, snippet: string): { eventType: string; score: number } {
  const text = `${subject} ${snippet}`;

  const checks: Array<{ type: string; patterns: RegExp[]; weight: number; priority: number }> = [
    // priority 3 = terminal outcomes — always beat lower-priority types
    { type: "offer",       patterns: JOB_PATTERNS.offer,       weight: 3, priority: 3 },
    { type: "rejected",    patterns: JOB_PATTERNS.rejection,   weight: 3, priority: 3 },
    // priority 2 = active pipeline stages
    { type: "interview",   patterns: JOB_PATTERNS.interview,   weight: 2, priority: 2 },
    { type: "assessment",  patterns: JOB_PATTERNS.assessment,  weight: 2, priority: 2 },
    { type: "screening",   patterns: JOB_PATTERNS.screening,   weight: 2, priority: 2 },
    // priority 1 = weakest signal — only wins if nothing stronger matches
    { type: "applied",     patterns: JOB_PATTERNS.application, weight: 2, priority: 1 },
  ];

  // Extra rejection phrases not covered by pattern list
  const HARD_REJECTION_PHRASES = [
    /not be able to take your candidature forward/i,
    /not be moving forward with your (application|candidature|profile)/i,
    /unable to (proceed|move forward) with your (application|candidature)/i,
    /will not be (shortlisting|progressing|proceeding)/i,
    /your profile (does not|doesn.t) (match|meet|fit)/i,
    /we have (decided|chosen) to (move forward|proceed) with other/i,
    /not shortlisted/i,
    /application (has been|was) (rejected|declined|unsuccessful|not selected)/i,
    /after careful (consideration|review|evaluation).*(unfortunately|regret|not)/i,
    /we appreciate your interest.*(however|but|unfortunately)/i,
    /thank you for (your interest|applying).*(unfortunately|however|regret)/i,
    /we.*(will not|won.t|cannot|can not) be (able to )?(move|proceed|continue)/i,
    /your candidature (will not|won.t|has not) be (taken|moved|considered)/i,
    /does not align with (our|the) (current|present) (requirements|needs|openings)/i,
  ];

  // Hard interview phrases — override lower-priority matches
  const HARD_INTERVIEW_PHRASES = [
    /you (have been|are|were) (shortlisted|selected)/i,
    /congratulations.*(shortlisted|selected|interview|next round)/i,
    /pleased to (inform|let you know).*(shortlisted|selected|interview)/i,
    /we (would like|want) to (invite|schedule|set up).*(interview|call|meeting)/i,
    /interview (scheduled|confirmed|invitation)/i,
    /join.*(teams|zoom|google meet|meeting)/i,
  ];

  const combinedText = `${subject} ${snippet}`;
  
  // Check hard interview phrases first (they beat applied signals)
  if (HARD_INTERVIEW_PHRASES.some((p) => p.test(combinedText))) {
    return { eventType: "interview", score: 50 };
  }

  // Check hard rejection phrases
  if (HARD_REJECTION_PHRASES.some((p) => p.test(combinedText))) {
    return { eventType: "rejected", score: 99 };
  }

  // Modern ATS systems send from neutral domains like hiring@, recruiting@, etc.
  // If from a recruiter domain but no specific pattern matched, still classify as "applied" (update)
  // This catches generic recruiter emails like "Your profile remains under review"
  const recruiterDomainPatterns = [
    /@greenhouse\./i,
    /@lever\.co/i,
    /@workday\.com/i,
    /@ashby\./i,
    /@naukri\./i,
    /@internshala\./i,
    /careers@/i,
    /recruiting@/i,
    /talent@/i,
    /hiring@/i,
    /jobs@/i,
  ];
  
  // If email is from known recruiter system/domain, even with low patterns, it's job-related
  // BUG FIX: Test against 'from' address, not subject line
  if (recruiterDomainPatterns.some((p) => p.test(from))) {
    // Give it minimum boost even if patterns didn't match
    return { eventType: "update", score: 2.5 };
  }

  let bestType = "update";
  let bestScore = 0;
  let bestPriority = 0;

  for (const { type, patterns, weight, priority } of checks) {
    let hits = 0;
    for (const p of patterns) {
      if (p.test(subject)) hits += 2; // subject match weighs double
      else if (p.test(snippet)) hits += 1;
    }
    const score = hits * weight;
    if (score > 0) {
      // Higher priority always beats lower priority, regardless of score
      // Within same priority, higher score wins
      if (priority > bestPriority || (priority === bestPriority && score > bestScore)) {
        bestScore = score;
        bestType = type;
        bestPriority = priority;
      }
    }
  }

  return { eventType: bestType, score: bestScore };
}

// ─────────────────────────────────────────────
// BLOCKLIST CHECK
// ─────────────────────────────────────────────

function isBlockedEmail(from: string, subject: string, snippet: string): boolean {
  const fromLower = from.toLowerCase();

  // Check blocked sender domains
  if (BLOCKED_SENDERS.some((domain) => fromLower.includes(domain))) return true;

  // Check blocked subject patterns
  if (BLOCKED_SUBJECT_PATTERNS.some((p) => p.test(subject))) return true;

  // Check blocked snippet patterns
  if (BLOCKED_SNIPPET_PATTERNS.some((p) => p.test(snippet))) return true;

  return false;
}

// ─────────────────────────────────────────────
// COMPANY EXTRACTION
// ─────────────────────────────────────────────

const GENERIC_SENDER_NAMES = [
  "careers", "jobs", "recruiting", "recruitment", "talent", "hr",
  "noreply", "no-reply", "notifications", "donotreply", "do-not-reply",
  "info", "hello", "team", "support", "hiring",
];

/** Detects if a string looks like a person's name (2-3 title-case words) */
function looksLikePersonName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  // Person names are usually 2-4 words, each starting uppercase
  if (words.length < 2 || words.length > 4) return false;
  // Every word should be title-case (starts uppercase, rest lowercase/mixed)
  const allTitleCase = words.every((w) => /^[A-Z][a-z]*$/.test(w) || /^[A-Z][a-z]+[A-Z]?[a-z]*$/.test(w));
  if (!allTitleCase) return false;
  // No company-like words
  const companyWords = ["inc", "llc", "ltd", "corp", "co", "pvt", "labs", "tech", "technologies", "software", "solutions", "services", "group", "systems"];
  if (words.some((w) => companyWords.includes(w.toLowerCase()))) return false;
  return true;
}

function extractCompany(from: string, subject: string, snippet?: string): string | null {
  const text = snippet ? `${subject} ${snippet}` : subject;

  // 1. Indian ATS patterns — "[Company] via Naukri" or "Naukri: [Company]" or "Internshala: [Company]"
  const naukriViaMatch = text.match(/([A-Z][a-zA-Z0-9 &.'-]{2,40})\s+via\s+(Naukri|Indeed|LinkedIn|Internshala|Unstop|Foundit)/i);
  if (naukriViaMatch) {
    const candidate = naukriViaMatch[1].trim();
    if (!looksLikePersonName(candidate)) return candidate;
  }

  const naukriColonMatch = text.match(/(Naukri|Internshala|Unstop|HirePro|Foundit)[.:]?\s*:?\s*([A-Z][a-zA-Z0-9 &.'-]{2,40})\s+(has|is|shortlisted|selected|invited)/i);
  if (naukriColonMatch) {
    const candidate = naukriColonMatch[2].trim();
    if (!looksLikePersonName(candidate)) return candidate;
  }

  // 2. "on behalf of [Company]" pattern
  const onBehalfMatch = text.match(/on behalf of\s+([A-Z][a-zA-Z0-9 &.'-]{2,40})/i);
  if (onBehalfMatch) {
    const candidate = onBehalfMatch[1].trim();
    if (!looksLikePersonName(candidate)) return candidate;
  }

  // 3. Try "at [Company]" or "to [Company]" in subject FIRST — most reliable
  // Use negative lookahead to avoid capturing "the [word]" patterns (e.g. "at the X" is usually descriptive, not a company).
  const atMatch = subject.match(/\b(?:at|to)\s+(?!the\s)([A-Z][a-zA-Z0-9 &.'-]{1,40})(?:\s*[,!?]|\s+for|\s+is|\s+we|$)/);
  if (atMatch) {
    let candidate = atMatch[1].trim();
    // Reject if too many words (likely grabbed surrounding phrase like "at reviewing the American Express")
    if (candidate.split(/\s+/).length <= 4 && !looksLikePersonName(candidate)) return candidate;
  }

  // 4. Try "with [Company]" in subject — e.g. "interview with Acme Corp"
  // Use strict word boundaries to avoid capturing across sentence boundaries.
  const withMatch = subject.match(/\bwith\s+(?!the\s)([A-Z][a-zA-Z0-9 &.'-]{1,40})(?:\s*[,!?\-]|\s+for|\s+is|\s+we|$)/);
  if (withMatch) {
    let candidate = withMatch[1].trim();
    if (candidate.split(/\s+/).length <= 4 && !looksLikePersonName(candidate)) return candidate;
  }

  // 5. Try subject lines that start with "[Company] -" or "[Company]:" — e.g. "Acme Corp - Interview Invitation"
  const ROLE_WORDS = /\b(engineer|developer|analyst|manager|intern|internship|associate|scientist|specialist|designer|consultant|architect|lead|senior|junior|executive|officer|director|coordinator|support|technician|programmer)\b/i;
  const leadingCompanyMatch = subject.match(/^([A-Z][a-zA-Z0-9 &.,']+(?:Corporation|Corp|Inc|Ltd|LLC|Technologies|Technology|Solutions|Services|Systems|Group|Labs|Studio|Studios)?)\s*[-:]/);
  if (leadingCompanyMatch) {
    const candidate = leadingCompanyMatch[1].trim();
    // Reject if it looks like a role title (e.g. "Software Engineer I - 26007841" should be rejected)
    if (!looksLikePersonName(candidate) && !ROLE_WORDS.test(candidate) && candidate.length > 2) return candidate;
  }

  // 6. Try "from [Company]" in subject
  const fromMatch = subject.match(/from\s+([A-Z][a-zA-Z0-9 &.'-]{1,40})(?:\s*[,!?]|$)/i);
  if (fromMatch) {
    const candidate = fromMatch[1].trim();
    if (!looksLikePersonName(candidate)) return candidate;
  }

  // 7. Try "Greetings from [Company]" in subject or snippet
  const greetingsMatch = text.match(/greetings from\s+([A-Z][a-zA-Z0-9 &.'-]{1,40})/i);
  if (greetingsMatch) return greetingsMatch[1].trim();

  // 8. Try "[Company] Careers" or "[Company] Hiring" or "[Company] HR" patterns
  const careersMatch = text.match(/([A-Z][a-zA-Z0-9 &.'-]{2,30})\s+(Careers|Hiring|HR|Recruitment|Talent)/i);
  if (careersMatch) {
    const candidate = careersMatch[1].trim();
    if (!looksLikePersonName(candidate)) return candidate;
  }

  // 9. Try sender display name — but skip if it looks like a person name
  const senderNameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (senderNameMatch) {
    let name = senderNameMatch[1].trim();
    // Remove generic words from the name
    name = name.replace(/\b(careers?|jobs?|recruiting|talent|team|hr|hiring|notifications?)\b/gi, "").trim();
    // Skip if it's a generic sender name OR looks like a person's name
    if (name.length > 1 && !GENERIC_SENDER_NAMES.some((g) => name.toLowerCase() === g)) {
      if (!looksLikePersonName(name)) {
        return name;
      }
    }
  }

  // 10. Fallback to email domain (exclude personal providers AND ATS platforms)
  const domainMatch = from.match(/@([a-z0-9-]+)\.[a-z]{2,}/i);
  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase();
    const personalProviders = ["gmail", "yahoo", "outlook", "hotmail", "icloud", "protonmail", "mail", "email", "live"];
    
    // Build ATS exclusion list from PLATFORMS to avoid returning "Naukri", "Workday", etc.
    const atsKeywords = Object.values(PLATFORMS).flat();
    const isAts = atsKeywords.some((k) => domain.includes(k) || from.toLowerCase().includes(k));
    
    if (!personalProviders.includes(domain) && !isAts && !BLOCKED_SENDERS.some((d) => d.includes(domain))) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    
    return null; // ATS domain with no real company found elsewhere — don't fabricate
  }

  return null;
}

// ─────────────────────────────────────────────
// ROLE EXTRACTION
// ─────────────────────────────────────────────

const ROLE_PATTERNS = [
  /for (?:the )?(.+?) (?:position|role|opening|vacancy)/i,
  /(.+?) (?:position|role) at/i,
  /applying (?:to|for) (?:the )?(.+?)(?:\s+at|\s+position|\s+role|[.,!?]|$)/i,
  /position:?\s*([^\n,]+)/i,
  /role:?\s*([^\n,]+)/i,
  /job title:?\s*([^\n,]+)/i,
  // Common title keywords
  /((?:senior|junior|lead|staff|principal|mid|associate)\s+)?(?:software|frontend|backend|full.?stack|mobile|devops|data|ml|ai|product|design|ux|ui|marketing|sales|finance)\s+(?:engineer|developer|scientist|analyst|designer|manager|lead)/i,
];

function extractRole(subject: string, snippet: string): string | null {
  const text = `${subject} ${snippet}`;
  for (const pattern of ROLE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const role = (match[1] || match[0]).trim();
      if (role.length > 2 && role.length < 80) return role;
    }
  }
  return null;
}

// Platform detection + PLATFORMS map now live in ./extractors (imported above).

// ─────────────────────────────────────────────
// PUBLIC PARSE FUNCTION
// ─────────────────────────────────────────────

// ParsedEmail interface is imported from email-parser.ts

export function parseEmail(
  from: string,
  subject: string,
  snippet: string
): ParsedEmail | null {
  // Hard blocklist first
  if (isBlockedEmail(from, subject, snippet)) return null;

  // Score the email — must have enough positive signals
        const { eventType, score } = scoreEmail(from, subject, snippet);
  if (score < MIN_CONFIDENCE) return null;

  // Extract company using layered pipeline (domain lookup → regex fallback)
  const layered = extractWithLayeredPipeline(from, subject, snippet);
  const company = layered.company || "Unknown Company";
  const company_confidence = layered.confidences.company;

  // Map the raw score to a meaningful status confidence so the pipeline can
  // decide when regex is trustworthy enough to skip the (rate-limited) AI call.
  //   score >= 50  → hard phrase match (rejection/interview) — very confident
  //   score >= 8   → multiple strong pattern hits
  //   score >= 4   → a single solid subject/snippet match
  //   below        → weak signal (e.g. recruiter-domain fallback)
  let status_confidence: number;
  if (score >= 50) status_confidence = 0.95;
  else if (score >= 8) status_confidence = 0.85;
  else if (score >= 4) status_confidence = 0.7;
  else status_confidence = 0.4;

  return {
    company,
    company_confidence,
    company_reasoning: company === "Unknown Company" 
      ? "Company not found in email text" 
      : `Extracted via ${layered.sources.company} (confidence: ${(company_confidence * 100).toFixed(0)}%)`,
    role: extractRole(subject, snippet) || undefined,
    eventType,
    status_confidence,
    status_reasoning: `Detected via regex patterns (score: ${score})`,
    parsedBy: "rules",
  };
}

// eventTypeToStatus now lives in ./normalize (imported above).

// ─────────────────────────────────────────────
// FIELD-LEVEL MERGE (regex ⊕ AI)
// ─────────────────────────────────────────────

/**
 * Combine the regex and AI parse results field-by-field, keeping the more
 * confident value for each field rather than letting one parser wholesale
 * replace the other. Deterministic hard-phrase regex matches (confidence
 * ≥ 0.95) for terminal states always win over the AI for status.
 */
function mergeParseResults(
  regex: ParsedEmail | null,
  ai: ParsedEmail | null,
): ParsedEmail | null {
  if (!regex) return ai;
  if (!ai) return regex;

  const regexHardTerminal =
    regex.status_confidence >= 0.95 &&
    (regex.eventType === "rejected" || regex.eventType === "offer");

  const useRegexStatus = regexHardTerminal || regex.status_confidence >= ai.status_confidence;
  const useRegexCompany =
    regex.company !== "Unknown Company" && regex.company_confidence >= ai.company_confidence;

  return {
    company: useRegexCompany ? regex.company : ai.company,
    company_confidence: Math.max(regex.company_confidence, ai.company_confidence),
    company_reasoning: useRegexCompany ? regex.company_reasoning : ai.company_reasoning,
    role: ai.role ?? regex.role,
    eventType: useRegexStatus ? regex.eventType : ai.eventType,
    status_confidence: Math.max(regex.status_confidence, ai.status_confidence),
    status_reasoning: useRegexStatus ? regex.status_reasoning : ai.status_reasoning,
    deadline: ai.deadline ?? regex.deadline,
    deadlineLabel: ai.deadlineLabel ?? regex.deadlineLabel,
    parsedBy: "ai",
    model: ai.model,
    parserVersion: ai.parserVersion ?? PARSER_VERSION,
  };
}

// ─────────────────────────────────────────────
// GMAIL SYNC
// ─────────────────────────────────────────────

export async function syncGmailEmails(
  userId: string,
  accessToken: string,
  dateRange?: DateRangeType
): Promise<{ newJobs: number; newEvents: number; errors: string[]; debug?: any }> {
  const startTime = Date.now();
  const result = { newJobs: 0, newEvents: 0, errors: [] as string[], debug: null as any };
  const pipelineDebugger = new (require("./pipeline-debug").PipelineDebugger)();

  try {
    PipelineTracer.fetchStart(0); // Will update after fetch
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // CRITICAL FIX: Fetch RECEIVED emails only (inbox), exclude sent mail
    // Build Gmail query with optional date range filtering
    // Defaults to all emails but can be constrained to specific date range for large datasets
    const query = buildGmailQuery(dateRange ?? { type: "all" });

    // PAGINATION: Fetch ALL emails, not just first 150
    let allMessages: any[] = [];
    let nextPageToken: string | undefined;
    const maxPages = 10; // Safety limit
    let pageCount = 0;

    do {
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 100, // Smaller batch per page for efficiency
        pageToken: nextPageToken,
      });

      const messages = listResponse.data.messages || [];
      allMessages = allMessages.concat(messages);
      nextPageToken = listResponse.data.nextPageToken ?? undefined;
      pageCount++;

      console.log(`[Pipeline] Fetched page ${pageCount}: ${messages.length} emails (total: ${allMessages.length})`);

      if (!nextPageToken || pageCount >= maxPages) break;
    } while (true);

    pipelineDebugger.recordStage("fetch", 1, allMessages.length > 0 ? 1 : 0);
    console.log(`[Pipeline] Total emails from Gmail: ${allMessages.length}`);

    if (allMessages.length === 0) {
      result.debug = pipelineDebugger.logSummary();
      await updateUserLastSynced(userId);
      return result;
    }

    // Process all messages (Supabase will handle deduplication via gmail_message_id unique constraint)
    console.log(`[Pipeline] Processing ${allMessages.length} emails`);

    const parsedEmails: any[] = [];
    
    // CRITICAL: Hard time budget to prevent Vercel function timeout
    // Vercel default timeout is 10s (Hobby) to 60s (Pro). Stay well under that.
    const SYNC_TIME_BUDGET_MS = 45_000; // 45 seconds
    const syncStart = Date.now();
    let earlyStop = false;

    for (const message of allMessages) {
      if (!message.id) continue;
      
      // Check time budget every email
      if (Date.now() - syncStart > SYNC_TIME_BUDGET_MS) {
        const elapsed = Date.now() - syncStart;
        log.warn(`[CRITICAL] Time budget exceeded (${elapsed}ms > ${SYNC_TIME_BUDGET_MS}ms), stopping sync early`);
        log.warn(`[CRITICAL] Processed ${parsedEmails.length} of ${newMessages.length} emails. Remainder will be retried next sync.`);
        earlyStop = true;
        break; // Stop processing new emails
      }

      try {
        // Fetch full message to get body content for better parsing
        const msgResponse = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });

        const headers = msgResponse.data.payload?.headers || [];
        const from     = headers.find((h) => h.name === "From")?.value || "";
        const subject  = headers.find((h) => h.name === "Subject")?.value || "";
        const dateStr  = headers.find((h) => h.name === "Date")?.value;
        const snippet  = msgResponse.data.snippet || "";
        const threadId = msgResponse.data.threadId || message.id;

        // Create tracer for this email
        const tracer = new EmailTracer(message.id);
        tracer.header(subject, from, dateStr || new Date().toISOString());

        tracer.step("Email Fetched", "ok");

        // Extract body text from the message payload
        // CRITICAL FIX: Use first 2000 + last 2000 chars because important info (company, role, deadline) is often at end
        tracer.step("HTML Cleaning", "start");
        const bodyText = extractBodyText(msgResponse.data.payload ?? undefined);
        let contentForParsing = snippet;
        if (bodyText) {
          if (bodyText.length > 4000) {
            contentForParsing = bodyText.slice(0, 2000) + "\n[...]\n" + bodyText.slice(-2000);
          } else {
            contentForParsing = bodyText;
          }
        }
        tracer.log("Cleaned Body Length", contentForParsing.length);
        tracer.step("HTML Cleaning", "ok");

        // 1. Hard blocklist check (fast, free)
        tracer.step("Blocklist Check", "start");
        if (isBlockedEmail(from, subject, contentForParsing)) {
          tracer.warning("Blocked sender");
          tracer.step("Blocklist Check", "skip");
          pipelineDebugger.recordEmail(message.id, "blocklist", "fail", "blocked_sender");
          tracer.close();
          continue;
        }
        tracer.step("Blocklist Check", "ok");

        // 1.5. Early recruitment classifier — reject insurance, banking, marketing, etc emails.
        //      This saves parsing and AI calls on non-recruitment emails.
        tracer.step("Recruitment Check", "start");
        if (!isRecruitmentEmail(subject, from, snippet || "")) {
          tracer.log("Not Recruitment", "early rejection");
          tracer.step("Recruitment Check", "skip");
          pipelineDebugger.recordEmail(message.id, "parsing", "skip", "not_recruitment");
          tracer.close();
          continue;
        }
        tracer.step("Recruitment Check", "ok");

        // 2. Deterministic structured extraction runs on EVERY email (free).
        //    Pulls platform, application/requisition/candidate IDs, interview
        //    date/time/timezone/links, assessment links, deadlines, salary,
        //    work mode, recruiter identity and URLs.
        tracer.step("Structured Extraction", "start");
        const fields: ExtractedFields = extractStructuredFields(from, subject, bodyText || contentForParsing);
        if (!fields.platform) fields.platform = detectPlatform(from, bodyText);
        
        // Try to extract company from sender domain (before regex/AI) — high precision.
        const domainCompany = extractCompanyFromDomain(from);
        if (domainCompany && !fields.location) {
          tracer.log("Domain Company", domainCompany);
        }
        
        tracer.log("Platform", fields.platform ?? "unknown");
        tracer.step("Structured Extraction", "ok");

        // 3a. Platform-specific deterministic parser — extracts status (interview/rejected/offer/etc)
        let platformResult: ParsedEmail | null = null;
        if (fields.platform) {
          tracer.step("Platform Parser", "start");
          platformResult = parsePlatformSpecific(from, subject, contentForParsing, fields.platform);
          if (platformResult) {
            tracer.log("Platform Match", fields.platform);
            tracer.step("Platform Parser", "ok");
          } else {
            tracer.step("Platform Parser", "skip");
          }
        }

        // 3b. ALWAYS run regex-based company/role extraction (parseEmail) — don't bypass it
        //     even if platform parser succeeded. Platform parsers extract STATUS well but
        //     return "Unknown Company" for Greenhouse/Workday/Lever. We need parseEmail's
        //     company extraction logic to run, then intelligently merge both results.
        tracer.step("Regex Parse", "start");
        const regexOnly = parseEmail(from, subject, contentForParsing);
        
        // Validate extracted company early — reject stopwords/garbage
        if (regexOnly && !isValidCompany(regexOnly.company)) {
          regexOnly.company = "Unknown Company";
          regexOnly.company_confidence = 0.1;
        }
        
        // Merge platform status + regex company/role (best of both)
        let regexResult: ParsedEmail | null = null;
        if (platformResult && regexOnly) {
          // Both succeeded: use platform for status, regex for company/role
          // But validate company to reject stopwords/garbage ("The", "lways interested", etc.)
          const regexCompany = regexOnly.company !== "Unknown Company" && isValidCompany(regexOnly.company) 
            ? regexOnly.company 
            : platformResult.company;
          regexResult = {
            ...platformResult,
            company: regexCompany,
            company_confidence: regexCompany !== platformResult.company ? regexOnly.company_confidence : platformResult.company_confidence,
            company_reasoning: regexCompany !== platformResult.company ? regexOnly.company_reasoning : platformResult.company_reasoning,
            role: regexOnly.role ?? platformResult.role,
          };
          tracer.log("Merged", `Platform(status) + Regex(company="${regexResult.company}")`);
        } else if (platformResult) {
          // Only platform succeeded
          regexResult = platformResult;
          tracer.log("Platform Only", fields.platform);
        } else if (regexOnly) {
          // Only regex succeeded (company already validated)
          regexResult = regexOnly;
          tracer.log("Regex Company", regexResult.company);
          tracer.log("Regex Status", regexResult.eventType);
        }
        
        tracer.step("Regex Parse", regexResult ? "ok" : "skip");

        // 4. Use domain company if available when company is missing
        const companyMissing = !regexResult || regexResult.company === "Unknown Company";
        if (companyMissing && domainCompany) {
          if (regexResult) {
            // If regex gave us something, patch it with domain company
            regexResult.company = domainCompany;
            regexResult.company_confidence = 0.8;
            tracer.log("Domain Override", `${domainCompany} (0.8)`);
          } else {
            // If regex gave us nothing, create a minimal result with domain company
            regexResult = {
              company: domainCompany,
              company_confidence: 0.8,
              company_reasoning: "Domain-based fallback (no regex signal)",
              role: undefined,
              eventType: "update",
              status_confidence: 0.3,
              status_reasoning: "No pattern matched",
              parsedBy: "rules",
            };
            tracer.log("Domain Fallback", domainCompany);
          }
        }
        
        // Call AI if status is uncertain (company is often well-extracted by regex, but status is ambiguous)
        // Thresholds: company > 0.5 is "good enough", status < 0.7 is "uncertain"
        const companyUncertain = !regexResult || regexResult.company === "Unknown Company" || regexResult.company_confidence <= 0.5;
        const statusUncertain = !regexResult || regexResult.status_confidence < 0.7;
        
        // Call AI if status is uncertain AND we haven't disabled AI
        // Note: even if company is uncertain, if status is confident, save it; can enrich company later
        const needsAi = statusUncertain && !AI_DISABLED;

        let aiResult: ParsedEmail | null = null;
        if (AI_DISABLED) {
          tracer.log("AI Disabled", "DISABLE_AI_FALLBACK=true (emergency kill-switch active)");
        } else if (needsAi) {
          // 5. Critical fields unresolved — consult AI (cached, rate-limited, retried).
          aiResult = await parseEmailWithAI(from, subject, contentForParsing, threadId, tracer);
        } else {
          const reason = !statusUncertain ? "status confident, no AI needed" : "company uncertain but status known";
          tracer.log("AI Skipped", reason);
        }

        // 6. Field-level merge of (platform/regex) ⊕ AI (best value per field).
        const parsed = mergeParseResults(regexResult, aiResult);

        if (!parsed) {
          tracer.step("Parsing", "skip");
          tracer.warning("Neither regex nor AI produced a result");
          pipelineDebugger.recordEmail(message.id, "parsing", "fail", "low_confidence");
          tracer.close();
          continue;
        }

        // Prefer the deterministically-extracted deadline when present.
        if (fields.deadline && !parsed.deadline) parsed.deadline = fields.deadline;
        if (fields.platform && !parsed.role) {
          /* platform captured separately below */
        }

        tracer.step("Final Merge", "ok");
        tracer.parsedObject(parsed);
        pipelineDebugger.recordEmail(message.id, "parsing", "pass");
        parsedEmails.push({
          gmailId: message.id,
          from,
          subject,
          snippet,
          rawBody: bodyText,
          normalizedBody: contentForParsing,
          timestamp: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          threadId,
          company: parsed.company,
          role: parsed.role ?? null,
          eventType: parsed.eventType,
          confidence: parsed.status_confidence,
          parsedBy: parsed.parsedBy,
          model: parsed.model ?? null,
          parserVersion: parsed.parserVersion ?? PARSER_VERSION,
          fields,
          regexResult: regexResult ?? null,
          aiResult: aiResult ?? null,
          merged: parsed,
        });
        tracer.close();
      } catch (msgError) {
        console.error("Error processing message:", message.id, msgError);
        result.errors.push(`Failed to process message ${message.id}`);
      }
    }

    // COUNT CLASSIFICATIONS
    const classifications = {
      applied: 0,
      interview: 0,
      assessment: 0,
      offer: 0,
      rejected: 0,
      update: 0,
    };

    for (const email of parsedEmails) {
      const type = email.eventType;
      if (type in classifications) {
        classifications[type as keyof typeof classifications]++;
      }
    }

    PipelineTracer.parseComplete(
      parsedEmails.length,
      classifications.applied,
      classifications.interview,
      classifications.assessment,
      classifications.offer,
      classifications.rejected
    );

    // Application Resolver — collapse emails into real applications, then
    // fuzzy-merge company-name variants (transitive clustering).
    console.log("[v0] CRITICAL: parsedEmails.length =", parsedEmails.length);
    console.log("[v0] CRITICAL: parsedEmails[0] =", parsedEmails[0]);
    const resolvedApps = resolveApplications(parsedEmails as ParsedEmailRecord[]);
    console.log("[v0] CRITICAL: resolvedApps.length =", resolvedApps.length);
    log.debug(`Resolved ${resolvedApps.length} applications before fuzzy merge`);

    const fuzzyMergedApps = fuzzyMatchApplications(resolvedApps);
    console.log("[v0] CRITICAL: fuzzyMergedApps.length =", fuzzyMergedApps.length);
    log.info(`Created ${fuzzyMergedApps.length} applications from ${parsedEmails.length} parsed emails`);
    console.log("[v0] DEBUG: fuzzyMergedApps length:", fuzzyMergedApps.length);
    if (fuzzyMergedApps.length === 0 && parsedEmails.length > 0) {
      console.log("[v0] DEBUG: No apps after fuzzy merge. Resolved apps:", resolvedApps.length);
    }
    pipelineDebugger.recordStage("parsing", newMessages.length, parsedEmails.length);

    // Create/update jobs and events from resolved applications.
    for (const app of fuzzyMergedApps) {
      try {
        const f = app.fields;
        console.log("[v0] DEBUG: Creating job for company:", app.company);
        const job = await findOrCreateJob(userId, app.company, {
          role: app.role,
          status: app.finalStatus,
          confidence: app.confidence,
          appliedDate: app.firstEventDate,
          lastActivity: app.lastEventDate,
          location: f.location ?? null,
          work_mode: f.workMode ?? null,
          platform: f.platform ?? null,
          deadline: f.deadline ?? null,
          application_id: f.applicationId ?? null,
          requisition_id: f.requisitionId ?? null,
          candidate_id: f.candidateId ?? null,
          interview_date: f.interviewDate ?? null,
          interview_time: f.interviewTimeRaw ?? null,
          timezone: f.timezone ?? null,
          interview_link: f.interviewLink ?? null,
          assessment_link: f.assessmentLink ?? null,
          coding_platform: f.codingPlatform ?? null,
          salary: f.salaryRaw ?? null,
          job_url: f.jobUrl ?? null,
          career_portal_url: f.careerPortalUrl ?? null,
          recruiter_name: f.recruiterName ?? null,
          recruiter_email: f.recruiterEmail ?? null,
          gmailThreadId: app.threadIds[0] ?? app.events[0]?.gmailId,
        });

        if (!job) {
          log.warn(`Failed to create/find job for ${app.company}`);
          console.log("[v0] DEBUG: Job creation failed for", app.company);
          continue;
        }

        const isNewJob = new Date(job.created_at).getTime() > Date.now() - 5000;
        console.log("[v0] DEBUG: Job created/updated. ID:", job.id, "New:", isNewJob);
        if (isNewJob) result.newJobs++;

        for (const event of app.events) {
          const src = parsedEmails.find((e) => e.gmailId === event.gmailId);
          const jobEvent = await createEmailEvent({
            job_id: job.id,
            user_id: userId,
            event_type: event.eventType,
            event_date: event.timestamp,
            email_subject: src?.subject || "",
            email_snippet: src?.snippet || "",
            gmail_message_id: event.gmailId,
            gmail_thread_id: src?.threadId ?? null,
            sender: src?.from ?? null,
            parsed_by: src?.parsedBy || "rules",
            parser_version: src?.parserVersion ?? PARSER_VERSION,
            model_used: src?.model ?? null,
            confidence: src?.confidence ?? app.confidence,
            raw_email: src?.rawBody ?? null,
            normalized_email: src?.normalizedBody ?? null,
            regex_result: (src?.regexResult as Record<string, unknown> | null) ?? null,
            ai_result: (src?.aiResult as Record<string, unknown> | null) ?? null,
            merged_result: (src?.merged as Record<string, unknown> | null) ?? null,
            raw_extracted: {
              company: app.company,
              role: app.role,
              confidence: app.confidence,
              fields: src?.fields ?? app.fields,
            },
          });

          if (jobEvent) result.newEvents++;
        }
      } catch (appError) {
        log.error(`Error creating application for ${app.company}`, appError);
        result.errors.push(`Failed to create application for ${app.company}`);
      }
    }

    await updateUserLastSynced(userId);
    result.debug = pipelineDebugger.logSummary();
    
    const elapsed = Date.now() - startTime;
    PipelineTracer.syncComplete(result.newJobs, result.newEvents, result.errors.length, elapsed);
  } catch (error) {
    console.error("Gmail sync error:", error);
    result.errors.push("Failed to sync Gmail");
  }

  return result;
}

/**
 * Streaming Email Sync — Process emails incrementally and call onJobSaved for each
 * 
 * High-confidence jobs (company_confidence >= 0.7) are saved and sent immediately.
 * This provides instant feedback instead of waiting for batch processing to complete.
 */
export async function syncGmailEmailsStreaming(
  userId: string,
  accessToken: string,
  dateRange?: any,
  onJobSaved?: (job: any) => void
): Promise<{
  processedEmails: number;
  newJobs: number;
  newEvents: number;
  skipped: number;
}> {
  const log = createLogger("SyncStreaming", userId);
  const tracer = new PerformanceTracer("email_sync_stream");
  
  const result = { processedEmails: 0, newJobs: 0, newEvents: 0, skipped: 0 };
  
  try {
    // Fetch emails
    const messages = await fetchGmailMessages(userId, accessToken, dateRange);
    log.info(`Fetched ${messages.length} emails`);
    result.processedEmails = messages.length;

    // Process each email independently (streaming)
    for (const message of messages) {
      try {
        const { subject, from, snippet, contentForParsing } = await extractEmailContent(
          userId,
          accessToken,
          message.id
        );

        // Parse email
        const regexOnly = parseEmail(from, subject, contentForParsing);
        
        if (!regexOnly) {
          result.skipped++;
          continue;
        }

        // Validate company early
        if (!isValidCompany(regexOnly.company)) {
          regexOnly.company = "Unknown Company";
          regexOnly.company_confidence = 0.1;
        }

        // FILTERING: Only save high-confidence jobs (>= 0.7)
        if (regexOnly.company_confidence < 0.7) {
          result.skipped++;
          continue;
        }

        // Create job immediately (streaming save)
        try {
          const job = await findOrCreateJob(userId, {
            company: regexOnly.company,
            role: regexOnly.role || undefined,
            status: regexOnly.eventType,
            source: "gmail",
          });

          if (job) {
            result.newJobs++;
            
            // Create event
            const event = await createEmailEvent(userId, job.id, {
              gmail_message_id: message.id,
              email_subject: subject,
              event_type: regexOnly.eventType,
              confidence: regexOnly.company_confidence,
              reasoning: regexOnly.company_reasoning,
            });

            if (event) {
              result.newEvents++;
            }

            // Callback: send job immediately to client
            if (onJobSaved) {
              onJobSaved({
                id: job.id,
                company: job.company,
                role: job.role,
                status: job.status,
                source: "gmail",
                created_at: job.created_at,
                confidence: regexOnly.company_confidence,
              });
            }
          }
        } catch (err) {
          log.warn(`Failed to save job for ${regexOnly.company}: ${(err as Error).message}`);
        }
      } catch (err) {
        log.warn(`Failed to process email ${message.id}: ${(err as Error).message}`);
      }
    }

    log.info(`Streaming sync complete: ${result.newJobs} jobs, ${result.newEvents} events`);
    return result;
  } catch (err) {
    log.error("Streaming sync failed", err as Error);
    throw err;
  }
}
