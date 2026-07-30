/**
 * AI-powered email parser using the 7-step mental model.
 * Uses Claude via Vercel AI Gateway with structured output.
 * Falls back to null on failure — caller handles fallback to regex.
 */
import { Type } from "@google/genai";
import { ai } from "./gemini";
import { z } from "zod";
import { EmailTracer } from "./email-tracer";

// ─────────────────────────────────────────────
// RATE LIMITER — free-tier Gemini allows 5 req/min/model
// ─────────────────────────────────────────────
//
// Requests are serialized through a promise chain and spaced by a minimum
// interval so we never exceed the quota. This is the single biggest cause
// of the 429 "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" errors.
// Override via GEMINI_MIN_INTERVAL_MS (e.g. paid tier can lower it).

const GEMINI_MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 12_500);
const GEMINI_MAX_RETRIES = 1; // Reduced from 3 to avoid long waits on quota errors
// Emergency kill-switch: set DISABLE_AI_FALLBACK=true to skip AI entirely (useful when quota is 0)
export const AI_DISABLED = process.env.DISABLE_AI_FALLBACK === "true";
// Configurable model via env; defaults to stable gemini-2.0-flash (confirmed supported by @google/genai v2.12+).
// To use a different model: export GEMINI_MODEL=gemini-2.0-flash-001 (or your preferred model).
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const PARSER_VERSION = "3.1.0";

let lastGeminiCall = 0;
let rateLimitChain: Promise<void> = Promise.resolve();

// ─────────────────────────────────────────────
// CIRCUIT BREAKER — Gemini quota exhaustion detection
// ─────────────────────────────────────────────
// Once limit:0 is detected, skip all subsequent AI calls for the sync
// (and a 5-minute cooldown across syncs) to avoid wasting 10-28s per email
// on a dead quota.
let quotaExhaustedUntil: number | null = null;

function isQuotaKnownExhausted(): boolean {
  return quotaExhaustedUntil !== null && Date.now() < quotaExhaustedUntil;
}

function markQuotaExhausted(): void {
  const cooldownMs = 5 * 60 * 1000; // 5-minute cooldown
  quotaExhaustedUntil = Date.now() + cooldownMs;
  console.log("[v0] Gemini quota exhausted — circuit breaker active for 5 minutes. AI calls will be skipped.");
}

// ─────────────────────────────────────────────
// RESPONSE CACHE — identical emails (e.g. bulk ATS blasts) parse once.
// ─────────────────────────────────────────────
const CACHE_MAX = 500;
const responseCache = new Map<string, ParsedEmail | null>();

function cacheKey(from: string, subject: string, body: string): string {
  const norm = `${from}\u0000${subject}\u0000${body}`.toLowerCase().replace(/\s+/g, " ").trim();
  // Cheap 32-bit rolling hash — enough to key near-identical templated emails.
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
  return `${h}:${norm.length}`;
}

function cacheSet(key: string, value: ParsedEmail | null) {
  if (responseCache.size >= CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, value);
}

/** Serializes callers and enforces a minimum gap between Gemini requests. */
function acquireGeminiSlot(): Promise<void> {
  rateLimitChain = rateLimitChain.then(async () => {
    const wait = Math.max(0, lastGeminiCall + GEMINI_MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeminiCall = Date.now();
  });
  return rateLimitChain;
}

/** Extract HTTP status code from error response. */
function extractStatusCode(err: unknown): number | null {
  if (typeof err === "object" && err !== null) {
    if ("message" in err) {
      const match = String(err.message).match(/"code":(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

/** Determine if an error is retryable (429, 5xx). Permanent errors (4xx except 429) fail immediately. */
function isRetryableError(err: unknown, status: number | null): boolean {
  if (status === 429) {
    // 429 can mean rate-limited OR quota exhausted (limit: 0).
    // If quota is actually 0, retrying will never succeed — it's a permanent error.
    const errMsg = String((err as Error)?.message ?? "");
    // Check for quota exhausted indicators
    if (/"limit":\s*0\b/.test(errMsg) || /limit.*0/.test(errMsg) || errMsg.includes("generate_content_free_tier_requests")) {
      console.log("[v0] Gemini quota at 0 — not retrying (set DISABLE_AI_FALLBACK=true to skip AI entirely)");
      return false; // Quota is 0, don't retry
    }
    return true; // Rate limited (temporary), retry
  }
  if (status && status >= 500 && status < 600) return true; // Server errors — retry
  return false;
}

/** Runs a Gemini request through the rate limiter, retrying only on 429 and 5xx. */
async function generateContentRateLimited(
  params: Parameters<typeof ai.models.generateContent>[0]
): Promise<Awaited<ReturnType<typeof ai.models.generateContent>>> {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    await acquireGeminiSlot();
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const status = extractStatusCode(err);
      if (!isRetryableError(err, status) || attempt >= GEMINI_MAX_RETRIES) {
        // Permanent error or out of retries — fail immediately.
        throw err;
      }
      // Retryable (429 or 5xx) — back off and retry.
      const hint = String((err as Error).message || "").match(/retry in ([\d.]+)\s*s/i);
      const backoff = hint
        ? Math.ceil(parseFloat(hint[1]) * 1000) + 500
        : (attempt + 1) * GEMINI_MIN_INTERVAL_MS;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  // Unreachable, but satisfies the type checker.
  throw new Error("Gemini request failed after retries");
}

// ─────────────────────────────────────────────
// System prompt — exact mental model from the document
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are extracting FACTS from a recruitment email for a job application tracker. Your job is to identify objective facts, not make interpretations.

COMPANY NAME EXTRACTION:
- Search order: subject line → email body → email signature → sender name
- Look for explicit mentions like "at [CompanyName]", "for [CompanyName]", "[CompanyName] - ", "from [CompanyName]"
- CRITICAL: Never extract domain names or ATS platform names as companies
  - Ignore: @greenhouse.io, @lever.co, @workday.com, @ashby.ai, @smartrecruiters.com, @naukri.com, @linkedin.com, @internshala.com
  - Example: Email from "careers@acme.com" → Extract "Acme" from body/subject, NOT "acme.com"
- If subject says "Update on Your Application at Acowale" → extract "Acowale"
- If signature says "HR Team, Anudip Foundation" → extract "Anudip" or "Anudip Foundation"
- Strip legal suffixes: Inc, LLC, Pvt Ltd, Ltd, Corp, Corporation, Technologies, Tech, Inc., Ltd., Pvt
  - "Google Inc" → "Google", "Microsoft Corporation" → "Microsoft"
- ONLY return null if you cannot find the company name ANYWHERE in the email after thorough search

ROLE/POSITION EXTRACTION:
- Look for job titles: "Software Engineer", "Product Manager", "Data Analyst", "Junior Full-Stack Engineer"
- Patterns: "for the [ROLE]", "[ROLE] position", "role of [ROLE]", "as [ROLE]"
- ONLY extract if it's a real job title, not generic words like "position", "opening", "opportunity"
- Return null if no role found

STATUS/EVENT TYPE EXTRACTION - Read the email's INTENT:
Your task is to identify what the EMAIL is saying/asking, not guess the workflow stage.

REJECTION indicators (return "rejected"):
  - "unfortunately", "regret to inform", "not moving forward", "we regret", "unsuccessful", "not selected"
  - "does not meet our requirements", "does not align", "we decided to go with other candidates"
  - "after careful consideration, we..."
  - "thank you for your interest... however"
  - "your profile does not match"
  - "unable to proceed with your candidacy"
  → If ANY of these phrases exist, classify as REJECTED, regardless of other signals

OFFER indicators (return "offer"):
  - "pleased to offer", "happy to offer", "excited to offer", "we would like to offer"
  - "offer letter", "offer package", "joining date", "start date", "compensation package"
  - "welcome to the team", "we look forward to your joining"
  → If offer-related language exists, classify as OFFER

ASSESSMENT indicators (return "assessment"):
  - "complete this assessment", "take this test", "coding challenge", "online evaluation"
  - "HackerRank", "HackerEarth", "Codility", "LeetCode"
  - "test link", "assessment link", "challenge link"
  - "please complete by", "submit by", "due date for assessment"
  → If assessment-related language exists, classify as ASSESSMENT

INTERVIEW indicators (return "interview_invite"):
  - "schedule an interview", "interview invitation", "we would like to invite"
  - "shortlisted for interview", "selected for interview", "you have been shortlisted"
  - "interview on [date]", "interview scheduled"
  - "please confirm your availability for interview"
  - "meet with our team", "speak with our team"
  → If interview-related language exists, classify as INTERVIEW_INVITE

APPLICATION CONFIRMATION indicators (return "applied_confirmation"):
  - "received your application", "application received", "thank you for applying"
  - "we received your resume", "registration successful"
  - "under review", "reviewing your profile"
  - "we will be in touch", "keep an eye on your email"
  → If application acknowledgment language exists (and NOT rejection/offer/interview/assessment), classify as APPLIED_CONFIRMATION

Generic/unclear (return "follow_up"):
  - If you cannot definitively classify into above categories
  - Email is job-related but doesn't fit specific categories
  → Default to "follow_up", never guess

DEADLINE EXTRACTION:
- Only extract if explicit DATE is mentioned: "by July 15", "before Friday", "due 5pm"
- Return deadline field as the date
- Return deadline_for as what it applies to: "complete assessment by", "confirm interview slot by"
- Return null if no deadline mentioned

CONFIDENCE SCORES (separate for company and status):
- company_confidence: 0.0-1.0
  - 1.0: Company name explicitly stated in subject/body
  - 0.7: Found in signature or deep in body
  - 0.4: Inferred from context but not explicit
  - 0.1: No company found

- status_confidence: 0.0-1.0
  - 1.0: Clear explicit signal (rejection, offer, interview, assessment phrases)
  - 0.7: Moderate signal (some relevant keywords)
  - 0.4: Weak signal (ambiguous or implied)
  - 0.1: Unable to classify

REASONING FIELDS (one sentence each):
- company_reasoning: "Found in subject line", "Extracted from signature", "Not found in email"
- status_reasoning: "Clear rejection language detected", "Assessment request found", "Application confirmation message"`;

// ─────────────────────────────────────────────
// Output schema
// ─────────────────────────────────────────────

const ParsedEmailSchema = z.object({
  is_job_related: z.boolean(),
  company: z.string().nullable(),
  company_confidence: z.number().min(0).max(1),
  company_reasoning: z.string(),
  role: z.string().nullable(),
  status: z.enum([
    "applied_confirmation",
    "assessment",
    "interview_invite",
    "offer",
    "rejected",
    "follow_up",
  ]).nullable(),
  status_confidence: z.number().min(0).max(1),
  status_reasoning: z.string(),
  deadline: z.string().nullable(),
  deadline_for: z.string().nullable(),
});

export type AIParseResult = z.infer<typeof ParsedEmailSchema>;

// Map AI status to internal event type
const STATUS_TO_EVENT: Record<string, string> = {
  applied_confirmation: "applied",
  assessment:           "assessment",
  interview_invite:     "interview",
  offer:                "offer",
  rejected:             "rejected",
  follow_up:            "update",
};

// ─────────────────────────────────────────────
// PUBLIC FUNCTION
// ─────────────────────────────────────────────

export interface ParsedEmail {
  company: string;
  company_confidence: number;
  company_reasoning: string;
  role?: string;
  eventType: string;
  status_confidence: number;
  status_reasoning: string;
  deadline?: string;
  deadlineLabel?: string;
  parsedBy: "ai" | "rules";
  model?: string;
  parserVersion?: string;
}

export async function parseEmailWithAI(
  from: string,
  subject: string,
  bodyContent: string,
  threadId?: string,
  tracer?: EmailTracer
): Promise<ParsedEmail | null> {
  if (!tracer) tracer = new EmailTracer(threadId || "unknown");

  tracer.step("AI Processing", "start");

  // Serve identical templated emails from cache — avoids burning quota.
  const key = cacheKey(from, subject, bodyContent);
  if (responseCache.has(key)) {
    tracer.log("AI Cache", "hit");
    tracer.step("AI Processing", "ok");
    return responseCache.get(key) ?? null;
  }

  // Circuit breaker: if quota is known exhausted, skip AI entirely
  if (isQuotaKnownExhausted()) {
    tracer.log("AI Circuit Breaker", "quota exhausted, skipping without wait");
    tracer.step("AI Processing", "skip");
    return null;
  }

  // CRITICAL FIX: Include rich metadata to help Claude understand context
  const userPrompt = `FROM: ${from}
SUBJECT: ${subject}
${threadId ? `THREAD_ID: ${threadId}` : ""}

EMAIL BODY:
${bodyContent}

Extract the structured information from this email as facts, not interpretations.`;

  try {
    tracer.ai(SYSTEM_PROMPT, userPrompt);
    
    const response = await generateContentRateLimited({
      model: GEMINI_MODEL,
      contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,

      config: {
        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,

          properties: {
            is_job_related: {
              type: Type.BOOLEAN,
            },

            company: {
              type: Type.STRING,
              nullable: true,
            },

            company_confidence: {
              type: Type.NUMBER,
            },

            company_reasoning: {
              type: Type.STRING,
            },

            role: {
              type: Type.STRING,
              nullable: true,
            },

            status: {
              type: Type.STRING,
              nullable: true,
              enum: [
                "applied_confirmation",
                "assessment",
                "interview_invite",
                "offer",
                "rejected",
                "follow_up",
              ],
            },

            status_confidence: {
              type: Type.NUMBER,
            },

            status_reasoning: {
              type: Type.STRING,
            },

            deadline: {
              type: Type.STRING,
              nullable: true,
            },

            deadline_for: {
              type: Type.STRING,
              nullable: true,
            },
          },

          required: [
            "is_job_related",
            "company",
            "company_confidence",
            "company_reasoning",
            "role",
            "status",
            "status_confidence",
            "status_reasoning",
            "deadline",
            "deadline_for",
          ],
        },
      },
    });

    const result = ParsedEmailSchema.parse(
      JSON.parse(response.text ?? "{}")
    );
    tracer.log("Raw AI Response", result);

    // Not job related — skip
    if (!result.is_job_related) {
      tracer.step("AI Processing", "skip");
      tracer.warning("Not job-related");
      cacheSet(key, null);
      return null;
    }

    // Don't skip if company is missing — use placeholder
    const company = result.company || "Unknown Company";

    // Lower confidence threshold — accept even borderline emails
    if (result.status_confidence < 0.1) {
      tracer.step("AI Processing", "skip");
      tracer.warning(`Status confidence ${result.status_confidence?.toFixed(2)} < 0.1`);
      cacheSet(key, null);
      return null;
    }

    const eventType = result.status ? STATUS_TO_EVENT[result.status] ?? "update" : "update";

    const finalParsed = {
      company,
      company_confidence: result.company_confidence,
      company_reasoning: result.company_reasoning,
      role: result.role ?? undefined,
      eventType,
      status_confidence: result.status_confidence,
      status_reasoning: result.status_reasoning,
      deadline: result.deadline ?? undefined,
      deadlineLabel: result.deadline_for ?? undefined,
      parsedBy: "ai" as const,
      model: GEMINI_MODEL,
      parserVersion: PARSER_VERSION,
    };

    tracer.confidence(
      result.company_confidence || 0,
      result.role ? 0.7 : 0.5,
      result.status_confidence || 0
    );
    tracer.step("AI Processing", "ok");

    cacheSet(key, finalParsed);
    return finalParsed;
  } catch (err) {
    // AI call failed — caller will fall back to regex
    const errMsg = String((err as Error)?.message ?? "");
    
    // Check if quota exhausted (limit: 0) and activate circuit breaker
    if (/"limit":\s*0\b/.test(errMsg) || /limit.*0/.test(errMsg) || errMsg.includes("generate_content_free_tier_requests")) {
      markQuotaExhausted();
    }
    
    tracer.error("AI Processing", errMsg, err as Error);
    tracer.step("AI Processing", "error");
    return null;
  }
}
