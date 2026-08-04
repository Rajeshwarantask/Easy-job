/**
 * Platform Detector
 * 
 * Identifies which ATS/job platform an email came from based on:
 * - Sender domain and email address
 * - Subject line patterns
 * - Email body keywords and formatting
 * 
 * Returns: platform identifier and confidence score.
 */

export type PlatformId =
  | "indeed"
  | "greenhouse"
  | "workday"
  | "lever"
  | "ashby"
  | "generic";

export interface PlatformDetectionResult {
  platform: PlatformId;
  confidence: number; // 0-1
  reasoning: string;
  matchedPatterns: string[];
}

/**
 * Platform-specific detection patterns.
 */
const PLATFORM_PATTERNS: Record<PlatformId, {
  domains: string[];
  subdomains: string[];
  senderPatterns: RegExp[];
  subjectPatterns: RegExp[];
  bodyPatterns: RegExp[];
}> = {
  indeed: {
    domains: ["indeed.com", "indeed.co.in", "indeed.co.uk"],
    subdomains: ["noreply.indeed.com", "notifications.indeed.com"],
    senderPatterns: [
      /^noreply@indeed\./i,
      /^notifications@indeed\./i,
      /indeed.*@indeed\./i,
    ],
    subjectPatterns: [
      /indeed/i,
      /application.*received/i,
      /job.*alert/i,
      /you.*applied/i,
    ],
    bodyPatterns: [
      /indeed\.com/i,
      /indeed home/i,
      /my indeed/i,
      /application number/i,
      /view your application.*indeed/i,
    ],
  },

  greenhouse: {
    domains: ["greenhouse.io", "greenhouse.com"],
    subdomains: ["noreply.greenhouse.io", "notifications.greenhouse.io"],
    senderPatterns: [
      /^noreply@.*\.greenhouse\.io/i,
      /^greenhouse@/i,
      /greenhouse.*@.*\.io/i,
    ],
    subjectPatterns: [
      /greenhouse/i,
      /application.*received/i,
      /next.*step/i,
      /interview.*scheduled/i,
    ],
    bodyPatterns: [
      /greenhouse/i,
      /applications.*dashboard/i,
      /application.*url/i,
      /requisition/i,
    ],
  },

  workday: {
    domains: ["workday.com"],
    subdomains: [
      "noreply.workday.com",
      "notifications.workday.com",
      "candidates.workday.com",
    ],
    senderPatterns: [
      /^noreply@.*\.workday\.com/i,
      /^workday@/i,
      /careers\.workday\./i,
    ],
    subjectPatterns: [
      /workday/i,
      /candidate.*portal/i,
      /application.*status/i,
      /job.*application/i,
    ],
    bodyPatterns: [
      /workday/i,
      /candidate.*center/i,
      /application.*tracking/i,
      /careers\.workday\.com/i,
    ],
  },

  lever: {
    domains: ["lever.co", "levers.com"],
    subdomains: ["noreply.lever.co", "jobs.lever.co"],
    senderPatterns: [
      /^noreply@.*\.lever\.co/i,
      /^lever@/i,
      /jobs\.lever\.co/i,
    ],
    subjectPatterns: [
      /lever/i,
      /application.*received/i,
      /interview.*scheduled/i,
    ],
    bodyPatterns: [
      /lever/i,
      /jobs\.lever\.co/i,
      /application.*dashboard/i,
    ],
  },

  ashby: {
    domains: ["ashby.com"],
    subdomains: ["noreply.ashby.com", "candidates.ashby.com"],
    senderPatterns: [
      /^noreply@.*\.ashby\.com/i,
      /^ashby@/i,
    ],
    subjectPatterns: [
      /ashby/i,
      /application.*received/i,
    ],
    bodyPatterns: [
      /ashby/i,
      /apply\.ashby\.com/i,
      /candidate.*portal/i,
    ],
  },

  generic: {
    domains: [],
    subdomains: [],
    senderPatterns: [
      /recruiting|recruitment|talent|hr|hiring|careers/i,
    ],
    subjectPatterns: [
      /application|job|position|role|interview|offer|rejection/i,
    ],
    bodyPatterns: [
      /application|job|position|interview|offer/i,
    ],
  },
};

/**
 * Extract domain from email address.
 */
function extractDomain(email: string): string {
  const domain = email.split("@")[1];
  return domain ? domain.toLowerCase() : "";
}

/**
 * Check if domain or subdomain matches a pattern.
 */
function domainMatches(email: string, domains: string[], subdomains: string[]): boolean {
  const domain = extractDomain(email);

  // Direct domain match
  if (domains.some((d) => domain === d)) return true;
  if (subdomains.some((s) => domain === s)) return true;

  // Subdomain match (e.g., mycompany.workday.com)
  for (const pattern of [...domains, ...subdomains]) {
    if (domain.endsWith("." + pattern)) return true;
  }

  return false;
}

/**
 * Detect platform from email metadata and content.
 * 
 * Strategy:
 * 1. Check sender domain/email for platform indicators (high confidence)
 * 2. Check subject line for platform keywords
 * 3. Check body content for platform-specific language
 * 4. Accumulate confidence score from all sources
 * 5. Return highest confidence platform
 * 
 * @param from - Sender email address
 * @param subject - Email subject line
 * @param body - Email body text
 * @returns Platform detection result with confidence
 */
export function detectPlatform(from: string, subject: string, body: string): PlatformDetectionResult {
  const fullText = `${subject} ${body}`.toLowerCase();
  const results: Array<{
    platform: PlatformId;
    confidence: number;
    patterns: string[];
  }> = [];

  // Check each platform
  for (const [platformId, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    let confidence = 0;
    const matchedPatterns: string[] = [];

    // Step 1: Check domain (highest confidence)
    if (domainMatches(from, patterns.domains, patterns.subdomains)) {
      confidence += 0.6;
      matchedPatterns.push("domain-match");
    }

    // Step 2: Check sender pattern
    if (patterns.senderPatterns.some((p) => p.test(from))) {
      confidence += 0.2;
      matchedPatterns.push("sender-pattern");
    }

    // Step 3: Check subject patterns
    const subjectMatches = patterns.subjectPatterns.filter((p) => p.test(subject)).length;
    if (subjectMatches > 0) {
      confidence += Math.min(0.15, subjectMatches * 0.08);
      matchedPatterns.push(`subject-patterns(${subjectMatches})`);
    }

    // Step 4: Check body patterns
    const bodyMatches = patterns.bodyPatterns.filter((p) => p.test(fullText)).length;
    if (bodyMatches > 0) {
      confidence += Math.min(0.15, bodyMatches * 0.08);
      matchedPatterns.push(`body-patterns(${bodyMatches})`);
    }

    if (confidence > 0) {
      results.push({
        platform: platformId as PlatformId,
        confidence: Math.min(1, confidence),
        patterns: matchedPatterns,
      });
    }
  }

  // Sort by confidence and return highest
  if (results.length === 0) {
    return {
      platform: "generic",
      confidence: 0,
      reasoning: "No platform detected — using generic parser",
      matchedPatterns: [],
    };
  }

  results.sort((a, b) => b.confidence - a.confidence);
  const best = results[0];

  // If confidence is too low, fall back to generic
  if (best.confidence < 0.3) {
    return {
      platform: "generic",
      confidence: 0,
      reasoning: "Confidence too low — using generic parser",
      matchedPatterns: best.patterns,
    };
  }

  return {
    platform: best.platform,
    confidence: best.confidence,
    reasoning: `Detected ${best.platform} with ${(best.confidence * 100).toFixed(0)}% confidence`,
    matchedPatterns: best.patterns,
  };
}

/**
 * Check if a detected platform is sufficiently confident for use.
 */
export function isPlatformConfident(result: PlatformDetectionResult): boolean {
  // Generic platform is always low confidence — use for fallback only
  if (result.platform === "generic") return result.confidence >= 0.3;

  // Specific platforms need moderate confidence
  return result.confidence >= 0.4;
}
