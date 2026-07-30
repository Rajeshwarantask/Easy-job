/**
 * Layered Extraction Pipeline
 *
 * Layer 1: Known-entity lookup (highest confidence)
 * Layer 2: Platform-specific structured parsers
 * Layer 3: Generic regex fallback (validated)
 *
 * Each layer is tried in order. If a layer succeeds with validated data,
 * the result is used immediately. Lower layers are only reached when
 * higher layers fail or return invalid data.
 */

import domainLookup from './domain-lookup.json';

export interface ExtractionSource {
  company?: 'domain_lookup' | 'platform_parser' | 'regex_fallback';
  platform?: 'domain_lookup' | 'platform_parser';
  role?: 'platform_parser' | 'regex_fallback';
}

export interface ExtractedData {
  company?: string | null;
  platform?: string | null;
  role?: string | null;
  sources: ExtractionSource;
  confidences: {
    company: number;
    platform: number;
    role: number;
  };
}

// ─────────────────────────────────────────────
// VALIDATION UTILITIES
// ─────────────────────────────────────────────

const COMPANY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'your', 'this', 'that', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  'dear', 'hi', 'hello', 'thank', 'thanks', 'welcome', 'regards', 'sincerely',
  'interested', 'considering', 'reviewing', 'applying', 'please', 'thanks',
  'always', 'lways', 'urgent', 'urgently', 'looking', 'currently',
]);

function isValidCompanyCandidate(candidate: string): boolean {
  if (!candidate || candidate.length < 2 || candidate.length > 50) return false;

  const trimmed = candidate.trim();
  const words = trimmed.split(/\s+/).filter(w => w);

  // 1-4 words is reasonable for a company name
  if (words.length < 1 || words.length > 4) return false;

  // Check for stopwords
  if (words.some(w => COMPANY_STOPWORDS.has(w.toLowerCase()))) return false;

  // Must start with capital letter (usually indicates proper noun)
  if (!/^[A-Z]/.test(trimmed)) return false;

  return true;
}

// ─────────────────────────────────────────────
// LAYER 1: Domain Lookup
// ─────────────────────────────────────────────

export function layer1DomainLookup(from: string): Partial<ExtractedData> {
  const result: Partial<ExtractedData> = { sources: {}, confidences: { company: 0, platform: 0, role: 0 } };

  // Extract domain from email address
  const domainMatch = from.match(/@([a-z0-9.-]+)/i);
  if (!domainMatch) return result;

  const domain = domainMatch[1].toLowerCase();

  // Try direct domain match first
  const directMatch = (domainLookup.domains as Record<string, any>)[domain];
  if (directMatch) {
    result.company = directMatch.company;
    result.sources!.company = 'domain_lookup';
    result.confidences!.company = directMatch.confidence || 0.9;
    return result;
  }

  // Try partial domain match (e.g., recruitment.americanexpress.com → americanexpress.com)
  const baseDomain = domain.replace(/^[^.]+\./, '');
  const baseMatch = (domainLookup.domains as Record<string, any>)[baseDomain];
  if (baseMatch) {
    result.company = baseMatch.company;
    result.sources!.company = 'domain_lookup';
    result.confidences!.company = Math.max(0, (baseMatch.confidence || 0.9) - 0.1); // Slightly lower for partial match
    return result;
  }

  // Try platform lookup (but store as platform, not company)
  const platformMatch = (domainLookup.platforms as Record<string, any>)[domain];
  if (platformMatch) {
    result.platform = platformMatch;
    result.sources!.platform = 'domain_lookup';
    result.confidences!.platform = 0.95;
  }

  return result;
}

// ─────────────────────────────────────────────
// LAYER 3: Generic Regex Fallback (Validated)
// ─────────────────────────────────────────────

export function layer3RegexFallback(subject: string, body: string): Partial<ExtractedData> {
  const result: Partial<ExtractedData> = { sources: {}, confidences: { company: 0, platform: 0, role: 0 } };
  const text = `${subject} ${body}`;

  // Try to find company in common patterns
  // Pattern: "at {Company}" or "position at {Company}" or "{Company} - {Role}"
  const companyPatterns = [
    /(?:at|working at|joining|role at|position at|position with)\s+([A-Z][a-zA-Z0-9 &.'-]{2,40}?)(?:\s*[-–]|$|\s+(?:in|for|role))/i,
    /^([A-Z][a-zA-Z0-9 &.'-]{2,40}?)\s*[-–]\s+(?:job|role|position|opportunity)/i,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (isValidCompanyCandidate(candidate)) {
        result.company = candidate;
        result.sources!.company = 'regex_fallback';
        result.confidences!.company = 0.65; // Lower confidence for regex-only
        return result;
      }
    }
  }

  // If regex didn't find valid company, return null rather than garbage
  result.company = null;
  result.sources!.company = 'regex_fallback';
  result.confidences!.company = 0;

  return result;
}

// ─────────────────────────────────────────────
// Pipeline: Try layers in order
// ─────────────────────────────────────────────

export function extractWithLayeredPipeline(
  from: string,
  subject: string,
  body: string,
): ExtractedData {
  const result: ExtractedData = {
    company: undefined,
    platform: undefined,
    role: undefined,
    sources: { company: undefined, platform: undefined, role: undefined },
    confidences: { company: 0, platform: 0, role: 0 },
  };

  // Layer 1: Domain lookup (highest confidence, try first)
  const layer1 = layer1DomainLookup(from);
  if (layer1.company !== undefined && isValidCompanyCandidate(layer1.company)) {
    result.company = layer1.company;
    result.sources.company = layer1.sources?.company;
    result.confidences.company = layer1.confidences?.company ?? 0;
  }
  if (layer1.platform !== undefined) {
    result.platform = layer1.platform;
    result.sources.platform = layer1.sources?.platform;
    result.confidences.platform = layer1.confidences?.platform ?? 0;
  }

  // Layer 3: Generic regex fallback (only if Layer 1 didn't find company)
  if (!result.company) {
    const layer3 = layer3RegexFallback(subject, body);
    if (layer3.company !== undefined) {
      result.company = layer3.company;
      result.sources.company = layer3.sources?.company;
      result.confidences.company = layer3.confidences?.company ?? 0;
    }
  }

  return result;
}
