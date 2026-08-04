/**
 * Layer 6: Resolution
 * 
 * When multiple extractors produce different values for the same field,
 * resolve to the most trustworthy source.
 * 
 * Conflict resolution strategies:
 * 1. Highest confidence wins
 * 2. Canonical sources (company domain > email body > signature)
 * 3. Consistency with other fields
 * 4. Recency (newer > older for updates)
 */

export interface ExtractedField {
  value: any;
  confidence: number;
  source: string;
  extractor: string;
  timestamp: Date;
}

export interface ResolvedField {
  value: any;
  confidence: number;
  source: string;
  extractors: string[];
  conflictResolution: "single" | "confidence" | "canonical" | "consensus";
  reasoning: string;
}

/**
 * Canonical source rankings (higher = more trustworthy)
 */
const SOURCE_RANKING: Record<string, number> = {
  // Company identifiers are most reliable from official emails
  company_domain: 100,
  company_domain_from_header: 95,
  company_domain_from_email: 90,
  career_portal: 85,
  linkedin: 80,
  greenhouse: 75,
  workday: 75,
  lever: 75,
  ashby: 75,
  indeed: 70,
  email_body: 60,
  signature: 50,
  url_domain: 65,
  fallback: 0,
};

/**
 * Resolve conflicting field extractions.
 * Returns single winning value based on confidence and source reliability.
 */
export function resolveField(
  fieldName: string,
  extractions: ExtractedField[]
): ResolvedField {
  if (extractions.length === 0) {
    throw new Error(`No extractions for field: ${fieldName}`);
  }

  if (extractions.length === 1) {
    const e = extractions[0];
    return {
      value: e.value,
      confidence: e.confidence,
      source: e.source,
      extractors: [e.extractor],
      conflictResolution: "single",
      reasoning: "Only one extractor produced a value",
    };
  }

  // Multiple extractions - resolve
  // Strategy 1: Check if all agree
  const uniqueValues = new Set(extractions.map((e) => String(e.value)));
  if (uniqueValues.size === 1) {
    const e = extractions[0];
    return {
      value: e.value,
      confidence: Math.min(
        1,
        ...extractions.map((ex) => ex.confidence)
      ),
      source: e.source,
      extractors: extractions.map((ex) => ex.extractor),
      conflictResolution: "consensus",
      reasoning: "All extractors agree",
    };
  }

  // Strategy 2: Highest confidence wins, but check source reliability
  const scored = extractions.map((e) => ({
    ...e,
    score:
      e.confidence * 0.7 + (SOURCE_RANKING[e.source] || 0) * 0.3 / 100,
  }));

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // Check if runner-up is close (within 0.05)
  const runnerUp = scored[1];
  const isClose = Math.abs(winner.score - runnerUp.score) < 0.05;

  return {
    value: winner.value,
    confidence: winner.confidence,
    source: winner.source,
    extractors: scored.map((s) => s.extractor),
    conflictResolution: isClose ? "confidence" : "confidence",
    reasoning:
      isClose
        ? `Multiple sources suggest "${winner.value}" (${(winner.confidence * 100).toFixed(0)}% confidence). ${runnerUp.extractor} also suggested "${runnerUp.value}".`
        : `${winner.extractor} from ${winner.source} is most reliable (${(winner.score * 100).toFixed(0)} score)`,
  };
}

/**
 * Resolve all fields in a batch extraction result.
 */
export function resolveAllFields(
  extractions: Record<string, ExtractedField[]>
): Record<string, ResolvedField> {
  const resolved: Record<string, ResolvedField> = {};

  for (const [fieldName, fieldExtractions] of Object.entries(extractions)) {
    if (fieldExtractions.length > 0) {
      try {
        resolved[fieldName] = resolveField(fieldName, fieldExtractions);
      } catch (error) {
        console.error(`[v0] Error resolving field ${fieldName}:`, error);
      }
    }
  }

  return resolved;
}

/**
 * Check field consistency - if one field extraction impacts confidence of others.
 * 
 * Example: If company is "Google" but domain is "apple.com", lower confidence.
 */
export function checkFieldConsistency(
  company: string,
  domain: string,
  confidence: number
): { adjustedConfidence: number; inconsistency: string | null } {
  if (!company || !domain) {
    return { adjustedConfidence: confidence, inconsistency: null };
  }

  const companyNormalized = company.toLowerCase().trim();
  const domainNormalized = domain.toLowerCase().trim();

  // Check if company name appears in domain
  if (
    domainNormalized.includes(companyNormalized) ||
    companyNormalized.includes(domainNormalized.split(".")[0])
  ) {
    return {
      adjustedConfidence: Math.min(1, confidence + 0.1),
      inconsistency: null,
    };
  }

  // Company and domain don't match - reduce confidence
  return {
    adjustedConfidence: Math.max(0.3, confidence - 0.2),
    inconsistency: `Company "${company}" does not match domain "${domain}"`,
  };
}
