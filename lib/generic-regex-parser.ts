import { DeterministicParser } from "./deterministic-parser";
import type { DeterministicParseResult } from "./deterministic-parser";

/**
 * Generic Regex Parser — Last-resort fallback for non-ATS recruitment emails
 * 
 * This parser handles emails from individual recruiters, company career sites,
 * and other recruitment sources that don't use a dedicated ATS.
 * 
 * Key principle: Be conservative. Don't extract something unless it's very clear
 * and we have high confidence. It's better to return null and let the next
 * parser handle it than to return garbage like "reviewing the American Express".
 */

// ─────────────────────────────────────────────
// Stopword validation for extracted values
// ─────────────────────────────────────────────
const COMPANY_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "your", "this", "that", "our", "their",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "should", "could", "may", "might", "must", "can", "shall",
  "dear", "hi", "hello", "thank", "thanks", "welcome", "regards", "sincerely",
  "interested", "always", "lways", // common capture errors from body text
]);

export function isValidCompany(candidate: string): boolean {
  if (!candidate || candidate.length < 2) return false;
  const lower = candidate.toLowerCase().trim();
  
  // Single-word companies that are stopwords are almost never real companies
  if (!lower.includes(" ") && COMPANY_STOPWORDS.has(lower)) return false;
  
  // Common false positives from email greetings/body snippets
  if (/^(dear|hi|hello|thanks|interested)\s+\w+/i.test(candidate)) return false;
  
  return true;
}

class GenericRegexParser implements DeterministicParser {
  name = "generic_regex";
  priority = 10; // Very low priority — only run if nothing else matches

  canHandle(from: string, subject: string, platform: string | null): boolean {
    // This parser is a last-resort fallback — it always claims it can handle anything
    // (the priority system ensures platform-specific parsers run first)
    return true;
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    const result: Partial<DeterministicParseResult> = {
      status: "update",
      confidence: { company: 0, role: 0, status: 0 },
      sources: { company: "unknown", role: "unknown", status: "unknown" },
    };

    // Extract status/event type
    const statusMatch = this.extractStatus(subject, body);
    if (statusMatch) {
      result.status = statusMatch.status;
      result.confidence!.status = statusMatch.confidence;
      result.sources!.status = "regex";
    }

    // Extract role — only if VERY confident (0.8+)
    // Prefer null over incorrect values (Energy Exemplar false positives)
    const roleMatch = this.extractRole(subject, body);
    if (roleMatch && roleMatch.confidence >= 0.8) {
      result.role = roleMatch.role;
      result.confidence!.role = roleMatch.confidence;
      result.sources!.role = "regex";
    }

    // Note: Company extraction is NOT done here — it's handled at domain level
    // Do NOT try to extract company from body text, it produces garbage

    // If we extracted anything meaningful, return it
    if (result.status !== "update" || result.role) {
      return result;
    }

    return null;
  }

  private extractStatus(
    subject: string,
    body: string
  ): { status: "applied" | "rejected" | "offer" | "interview" | "update"; confidence: number } | null {
    const text = `${subject} ${body}`.toLowerCase();

    // Hard rejection patterns — 98% confidence
    const rejectionPatterns = [
      /not moving forward|not be moving forward|decided to pursue other candidates|not progressing|not shortlisted|application rejected|application unsuccessful/,
      /we appreciate your interest.*(however|but|unfortunately|regret)/,
      /thank you for applying.*(unfortunately|however|but|regret)/,
      /after careful consideration.*(unfortunately|regret|not able|unable)/,
      /will not be able to/,
      /unable to proceed/,
      /does not align with our|does not meet our|does not match/,
      /we have chosen|we chose|we selected other/,
    ];

    for (const pattern of rejectionPatterns) {
      if (pattern.test(text)) {
        return { status: "rejected", confidence: 0.95 };
      }
    }

    // Hard interview patterns — 95% confidence
    const interviewPatterns = [
      /you have been selected|you have been shortlisted|congratulations.*shortlisted|congratulations.*selected/,
      /we would like to invite you|please join us for an interview|let.?s schedule an interview/,
      /interview scheduled|interview confirmed|next round invitation/,
      /please join the meeting|zoom link|google meet|teams meeting/,
      /next steps|next stage|moving forward with you|moving you to the next|we.?re excited to/,
      /you.?re (a great fit|a strong candidate|moving forward)/,
    ];

    for (const pattern of interviewPatterns) {
      if (pattern.test(text)) {
        return { status: "interview", confidence: 0.95 };
      }
    }

    // Application received/confirmation patterns — 90% confidence
    const applicationReceivedPatterns = [
      /we have received your application|application received|received your submission/,
      /thank you for your interest|thanks for your application|thanks for applying/,
      /your application has been|application.*submitted successfully/,
    ];

    for (const pattern of applicationReceivedPatterns) {
      if (pattern.test(text)) {
        return { status: "applied", confidence: 0.9 };
      }
    }

    // Hard offer patterns — 95% confidence
    const offerPatterns = [/we (are pleased|are happy|are delighted) to offer|job offer|offer letter|congratulations.*offer/i];

    for (const pattern of offerPatterns) {
      if (pattern.test(text)) {
        return { status: "offer", confidence: 0.95 };
      }
    }

    // Application confirmation patterns — 85% confidence
    // Only match if it's clearly an application confirmation, not just a generic "update"
    const applicationPatterns = [
      /application (received|confirmed|submitted|acknowledged)/,
      /thank you for applying|we have received your application|your application has been received/,
      /application (is being reviewed|under review)/,
    ];

    for (const pattern of applicationPatterns) {
      if (pattern.test(text)) {
        return { status: "applied", confidence: 0.85 };
      }
    }

    return null;
  }

  private extractRole(subject: string, body: string): { role: string; confidence: number } | null {
    const text = `${subject} ${body}`;

    // Only extract role from subject line — snippets are too noisy
    // Reject matches that are too long (likely grabbed surrounding text)
    const patterns = [
      // "applying for Senior Engineer at Acme"
      /applying (?:for|to) (?:the |a )?([A-Za-z ]+?)(?:\s+(?:position|role|at|opportunity|job|$))/i,
      // "for the Senior Developer role"
      /for (?:the |a )?([A-Za-z ]+?)\s+(?:position|role|opening)/i,
      // Subject starts with role: "Senior Engineer - Interview" (common pattern)
      /^([A-Za-z ]+?)\s+(?:-|:|\|)\s+(?:interview|offer|rejection|update|application)/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        const candidate = match[1].trim();

        // Sanity checks
        if (candidate.length < 3 || candidate.length > 60) continue;
        if (candidate.split(/\s+/).length > 5) continue; // Too many words
        if (/^(the|and|or|at|to|for|from|in|on|with)$/i.test(candidate)) continue; // Just a preposition
        if (this.looksLikeGarbage(candidate)) continue;

        return { role: candidate, confidence: 0.8 };
      }
    }

    return null;
  }

  private looksLikeGarbage(text: string): boolean {
    const lower = text.toLowerCase();

    // Common junk that gets captured
    const junkPatterns = [
      /^(your|our|their|his|her)\s+/, // possessive pronouns
      /^(reviewing|considering|applying|sending|making)/, // action verbs at start
      /^(the|an?)\s+/, // articles at start
      /\s+(reviewed|reviewed|interest|thank|please|hi|hello|dear)$/, // trailing words
      /important|urgent|action required|please note/, // metadata
      /\s+(hi|hello|dear|regards)\s+\w+/, // greetings with names (Energy Exemplar Hi ...)
      /\s+and\s+/, // role is probably name+greeting if it has "and" in middle
    ];

    return junkPatterns.some((p) => p.test(lower));
  }
}

export function registerGenericRegexParser(): void {
  // This is called from platform-parsers.ts during initialization
  const { registry } = require("./deterministic-parser");
  registry.register(new GenericRegexParser());
}
