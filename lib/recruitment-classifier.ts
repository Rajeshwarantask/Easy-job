/**
 * Early-stage recruitment email classifier.
 * Rejects non-job emails (insurance, banking, marketing) before any parsing.
 * Extracts company from sender domain using known recruitment/corporate mappings.
 */

// ─────────────────────────────────────────────
// SENDER DOMAIN → COMPANY MAPPINGS
// ─────────────────────────────────────────────

const DOMAIN_TO_COMPANY: Record<string, string> = {
  // Tech/Major employers
  "google.com": "Google",
  "amazon.com": "Amazon",
  "microsoft.com": "Microsoft",
  "meta.com": "Meta",
  "apple.com": "Apple",
  "tesla.com": "Tesla",
  "netflix.com": "Netflix",
  "linkedin.com": "LinkedIn",
  "uber.com": "Uber",
  "airbnb.com": "Airbnb",
  "stripe.com": "Stripe",
  "databricks.com": "Databricks",
  "figma.com": "Figma",
  "canva.com": "Canva",
  "shopify.com": "Shopify",
  "square.com": "Square",
  "twilio.com": "Twilio",
  "intercom.com": "Intercom",
  "notion.com": "Notion",
  "airtable.com": "Airtable",

  // Banking/Finance (use as fallback only)
  "americanexpress.com": "American Express",
  "jpmorgan.com": "JPMorgan",
  "goldmansachs.com": "Goldman Sachs",
  "bofa.com": "Bank of America",
  "citigroup.com": "Citigroup",
  "wellsfargo.com": "Wells Fargo",

  // Insurance (usually not recruitment)
  "bajajfinserv.com": "Bajaj FinServ",
  "licindia.in": "LIC India",
  "icicibank.com": "ICICI Bank",

  // Consulting
  "accenture.com": "Accenture",
  "deloitte.com": "Deloitte",
  "pwc.com": "PwC",
  "kpmg.com": "KPMG",
  "mckinsey.com": "McKinsey",
  "bcg.com": "BCG",
  "bain.com": "Bain & Company",

  // Careers/Recruitment — specific company recruitment domains
  "cbts.com": "CBTS",
  "recruitment.americanexpress.com": "American Express",
  "careers.americanexpress.com": "American Express",
  
  // NOTE: ATS platform domains (workday.com, greenhouse.io, lever.co, etc) are intentionally
  // EXCLUDED here because they are NOT company names. Emails from these platforms have the
  // actual employer hidden in subject/body text or in the domain subdomain. Platform detection
  // and company extraction should be done by parseEmail() regex logic, not by domain mapping.
  // If you add entries here, every Greenhouse/Workday email will be saved as "Greenhouse"/"Workday".
};

/**
 * Extract company from sender domain using known mappings.
 * Returns null if domain not in mapping (will fall back to regex/AI).
 */
export function extractCompanyFromDomain(senderEmail: string): string | null {
  const domain = senderEmail.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Check for direct domain match
  if (DOMAIN_TO_COMPANY[domain]) return DOMAIN_TO_COMPANY[domain];

  // Check for subdomain match (e.g., careers.americanexpress.com)
  const parts = domain.split(".");
  for (let i = 1; i < parts.length; i++) {
    const parentDomain = parts.slice(i).join(".");
    if (DOMAIN_TO_COMPANY[parentDomain]) return DOMAIN_TO_COMPANY[parentDomain];
  }

  return null;
}

// ─────────────────────────────────────────────
// NON-RECRUITMENT EMAIL PATTERNS
// ─────────────────────────────────────────────

const NON_RECRUITMENT_PATTERNS = [
  // Insurance/Banking
  /\b(?:policy|premium|claim|deductible|coverage|renewal|enrollment)\b/i,
  /\b(?:loan|mortgage|credit|account|statement|transaction|balance)\b/i,
  /\b(?:insurance|life insurance|health insurance|auto insurance)\b/i,

  // Marketing/Newsletters
  /\b(?:newsletter|promotional|offer|discount|sale|coupon|deal)\b/i,
  /\b(?:marketing|campaign|webinar|event|conference)\b/i,
  /\b(?:subscribe|unsubscribe|preference|notification)\b/i,

  // HR/Admin (non-recruitment)
  /\b(?:payroll|tax|benefits|expense|reimbursement|leave|attendance)\b/i,
  /\b(?:performance review|evaluation|feedback|360|appraisal)\b/i,
  /\b(?:training|certification|course|learning)\b/i,

  // System/Transactional
  /\b(?:password reset|verify account|confirm email|2FA|mfa|authentication)\b/i,
  /\b(?:invoice|receipt|payment|billing|subscription)\b/i,
  /\b(?:order confirmation|shipment|delivery|tracking)\b/i,

  // Internal
  /\b(?:internal memo|all hands|company update|org change|restructuring)\b/i,
  /\b(?:bonus|raise|compensation|salary adjustment)\b/i,
];

/**
 * Classify email as recruitment-related or not.
 * Returns false if email is clearly non-recruitment (insurance, marketing, etc).
 * Returns true if recruitment-related or ambiguous (defer to parsing).
 */
export function isRecruitmentEmail(subject: string, from: string, bodySnippet: string): boolean {
  const fullText = `${subject} ${from} ${bodySnippet}`.toLowerCase();

  // Check for non-recruitment patterns
  const hasNonRecruitmentSignal = NON_RECRUITMENT_PATTERNS.some((pattern) =>
    pattern.test(fullText)
  );

  // If strong non-recruitment signals, classify as non-recruitment
  if (hasNonRecruitmentSignal) {
    return false;
  }

  // Default to recruitment (ambiguous emails defer to full parsing)
  return true;
}
