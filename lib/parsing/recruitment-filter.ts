/**
 * Recruitment Filter
 * 
 * Early-stage filter that rejects non-recruitment emails before parsing.
 * Prevents wasting CPU/API quota on insurance, marketing, banking, etc.
 * 
 * Uses simple pattern matching for high precision (low false positives).
 */

/**
 * Signals that indicate non-recruitment emails.
 */
const NON_RECRUITMENT_PATTERNS = [
  // Insurance/Financial services (common bulk senders)
  /\b(?:policy|premium|claim|deductible|coverage|renewal|enrollment)\b/i,
  /\b(?:insurance|life insurance|health insurance|auto insurance|term insurance)\b/i,
  /\b(?:premium amount|claim settlement|coverage details|policy number)\b/i,

  // Banking/Loans/Credit
  /\b(?:loan|mortgage|credit|account|statement|transaction|balance)\b/i,
  /\b(?:credit card|debit card|loan approval|mortgage rate)\b/i,
  /\b(?:banking|financial institution|credit bureau|credit score)\b/i,

  // Marketing/Newsletters/Spam
  /\b(?:newsletter|promotional|offer|discount|sale|coupon|deal|promotion)\b/i,
  /\b(?:marketing|campaign|webinar|conference|event|summit|expo)\b/i,
  /\b(?:subscribe|unsubscribe|preference center|notification settings)\b/i,

  // HR/Internal (non-recruitment)
  /\b(?:payroll|tax form|w-?2|1099|tax filing|tax return)\b/i,
  /\b(?:benefits|health insurance|retirement|401k|hra|fsa)\b/i,
  /\b(?:expense|reimbursement|receipt|invoice|billing)\b/i,
  /\b(?:performance review|evaluation|feedback|appraisal|360 review)\b/i,
  /\b(?:training|certification|course|learning|continuing education)\b/i,

  // System/Transactional
  /\b(?:password reset|verify account|confirm email|two-?factor|2fa|mfa|authentication)\b/i,
  /\b(?:verify your identity|confirm your account|update your password)\b/i,
  /\b(?:order confirmation|shipment|delivery|tracking|your order)\b/i,
  /\b(?:invoice|receipt|payment confirmation|billing)\b/i,
  /\b(?:subscription|renewal|upgrade|downgrade)\b/i,

  // Internal/Company
  /\b(?:internal memo|all hands meeting|company update|org change|reorganization|restructuring)\b/i,
  /\b(?:all company|team announcement|company-wide|internal news)\b/i,
  /\b(?:bonus|raise|salary|compensation adjustment)\b/i,
  /\b(?:off-?site|team building|company outing|social event)\b/i,

  // Support/Ticketing
  /\b(?:support ticket|bug report|issue created|issue resolved|ticket)\b/i,
  /\b(?:support response|agent message|assigned to|ticket status)\b/i,

  // Shipping/Delivery
  /\b(?:shipment|delivery|tracking number|shipped|tracking status)\b/i,
  /\b(?:out for delivery|delivered|in transit|carrier alert)\b/i,
];

/**
 * Signals that indicate recruitment emails (high confidence).
 * Used as a secondary confirmation if non-recruitment signals are weak.
 */
const RECRUITMENT_PATTERNS = [
  // Direct job application language
  /\b(?:application|candidate|job|position|role|vacancy|hiring)\b/i,
  /\b(?:applied|application received|received your application)\b/i,
  /\b(?:interview|interview scheduled|next round|interview date)\b/i,
  /\b(?:offer|job offer|offer extended|congratulations)\b/i,
  /\b(?:screening|assessment|test|coding challenge|take the test)\b/i,
  /\b(?:recruiter|recruitment|talent|hr|human resources)\b/i,

  // ATS system language
  /\b(?:applicant tracking|ats|job portal|career portal)\b/i,
  /\b(?:requisition|job code|application id|candidate id)\b/i,

  // Specific ATS platforms
  /\b(?:greenhouse|workday|lever|ashby|indeed|linkedin recruiter)\b/i,
  /\b(?:apply now|view job|view application|dashboard)\b/i,

  // Job-specific phrases
  /\b(?:job title|job description|role summary|about the role)\b/i,
  /\b(?:requirements|qualifications|requirements for this role)\b/i,
  /\b(?:salary|compensation|benefits|remote|hybrid|onsite)\b/i,
  /\b(?:startup|fast-?growing|hypergrowth|series [a-z])\b/i,
];

/**
 * Domains that are known ATS platforms or recruitment services.
 * Emails from these are almost always recruitment-related.
 */
const RECRUITMENT_DOMAINS = [
  "workday.com",
  "greenhouse.io",
  "lever.co",
  "ashby.com",
  "bamboohr.com",
  "talentdesk.io",
  "smartrecruiters.com",
  "jobvite.com",
  "hired.com",
  "greenhouse.com",
  "atsassistant.com",
  "nuroa.com",
  "recruitmint.com",
];

/**
 * Domains that are known non-recruitment or must be manually verified.
 */
const EXCLUDED_DOMAINS = [
  // Social media/dating (high false positives)
  "match.com",
  "tinder.com",
  "bumble.com",
  "hinge.app",

  // Community/forum platforms
  "reddit.com",
  "producthunt.com",
  "hackernews.com",

  // Ad networks/tracking
  "doubleclick.net",
  "googleadservices.com",
];

/**
 * Extract sender domain from email address.
 */
function extractDomain(email: string): string {
  const domain = email.split("@")[1];
  return domain ? domain.toLowerCase() : "";
}

/**
 * Check if domain is a known ATS/recruitment platform.
 */
function isRecruitmentDomain(domain: string): boolean {
  // Direct match
  if (RECRUITMENT_DOMAINS.includes(domain)) return true;

  // Subdomain check (e.g., mycompany.workday.com)
  for (const recruitDomain of RECRUITMENT_DOMAINS) {
    if (domain.endsWith("." + recruitDomain)) return true;
  }

  return false;
}

/**
 * Check if domain is excluded (known non-recruitment).
 */
function isExcludedDomain(domain: string): boolean {
  // Direct match
  if (EXCLUDED_DOMAINS.includes(domain)) return true;

  // Subdomain check
  for (const excludedDomain of EXCLUDED_DOMAINS) {
    if (domain.endsWith("." + excludedDomain)) return true;
  }

  return false;
}

/**
 * Filter result with reasoning.
 */
export interface FilterResult {
  isRecruiting: boolean;
  reason: string;
  confidence: number; // 0-1
}

/**
 * Determine if an email is recruitment-related.
 * 
 * Strategy:
 * 1. If from known recruitment domain → recruit (high confidence)
 * 2. If from excluded domain → not recruitment
 * 3. If strong non-recruitment patterns → not recruitment (high confidence)
 * 4. If recruitment patterns present → recruit (medium confidence)
 * 5. Default to recruit (ambiguous emails deferred to parsing)
 * 
 * @param subject - Email subject line
 * @param from - Sender email address
 * @param bodySnippet - Email body preview/snippet
 * @returns Filter result with confidence score
 */
export function filterRecruitmentEmail(
  subject: string,
  from: string,
  bodySnippet: string
): FilterResult {
  const domain = extractDomain(from);
  const fullText = `${subject} ${from} ${bodySnippet}`.toLowerCase();

  // Step 1: Check recruitment domain
  if (isRecruitmentDomain(domain)) {
    return {
      isRecruiting: true,
      reason: `Known recruitment domain: ${domain}`,
      confidence: 0.95,
    };
  }

  // Step 2: Check excluded domain
  if (isExcludedDomain(domain)) {
    return {
      isRecruiting: false,
      reason: `Known non-recruitment domain: ${domain}`,
      confidence: 0.95,
    };
  }

  // Step 3: Count non-recruitment patterns
  const nonRecruitmentMatches = NON_RECRUITMENT_PATTERNS.filter((pattern) =>
    pattern.test(fullText)
  ).length;

  // Strong non-recruitment signal (multiple patterns match)
  if (nonRecruitmentMatches >= 2) {
    return {
      isRecruiting: false,
      reason: `Strong non-recruitment signals (${nonRecruitmentMatches} patterns)`,
      confidence: 0.85,
    };
  }

  // Step 4: Count recruitment patterns
  const recruitmentMatches = RECRUITMENT_PATTERNS.filter((pattern) =>
    pattern.test(fullText)
  ).length;

  // Multiple recruitment patterns → high confidence
  if (recruitmentMatches >= 2) {
    return {
      isRecruiting: true,
      reason: `Multiple recruitment signals (${recruitmentMatches} patterns)`,
      confidence: 0.8,
    };
  }

  // Single recruitment pattern → medium confidence
  if (recruitmentMatches === 1) {
    return {
      isRecruiting: true,
      reason: "Single recruitment signal detected",
      confidence: 0.6,
    };
  }

  // Step 5: Default to recruitment (ambiguous)
  // This ensures job-related emails aren't accidentally filtered.
  // The full parser will validate later.
  return {
    isRecruiting: true,
    reason: "Ambiguous — deferred to full parser",
    confidence: 0.5,
  };
}

/**
 * Should this email be parsed? Used for quick early rejection.
 * 
 * @param subject - Email subject line
 * @param from - Sender email address
 * @param bodySnippet - Email body preview/snippet
 * @returns true if email should be parsed (or ambiguous), false if definitely non-recruitment
 */
export function shouldParseEmail(
  subject: string,
  from: string,
  bodySnippet: string
): boolean {
  const result = filterRecruitmentEmail(subject, from, bodySnippet);

  // Only skip if we're highly confident it's NOT recruitment
  if (!result.isRecruiting && result.confidence >= 0.8) {
    return false;
  }

  // Everything else gets parsed
  return true;
}
