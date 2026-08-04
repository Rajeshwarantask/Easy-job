import type { ExtractedFields } from "../pipeline";

/**
 * Company Resolver
 * Resolves company name conflicts with special logic
 */

const COMPANY_NORMALIZATIONS: Record<string, string> = {
  "google inc": "Google",
  "google llc": "Google",
  "alphabet inc": "Google",
  "microsoft corp": "Microsoft",
  "amazon.com": "Amazon",
  "apple inc": "Apple",
  "meta platforms": "Meta",
  "facebook inc": "Meta",
};

export function resolveCompany(extracted: ExtractedFields["company"][]): {
  value: string;
  confidence: number;
  reason: string;
} {
  if (!extracted || extracted.length === 0) {
    return { value: "", confidence: 0, reason: "No extractors produced company" };
  }

  // Filter out empty values
  const valid = extracted.filter((e) => e.value && e.value.trim());

  if (valid.length === 0) {
    return { value: "", confidence: 0, reason: "All extractors returned empty" };
  }

  // If only one extractor, use it
  if (valid.length === 1) {
    const normalized = normalizeCompanyName(valid[0].value!);
    return {
      value: normalized,
      confidence: valid[0].confidence,
      reason: `Only one extractor: ${valid[0].source}`,
    };
  }

  // If all agree on exact value, high confidence
  const firstValue = valid[0].value!.toLowerCase().trim();
  if (valid.every((e) => e.value!.toLowerCase().trim() === firstValue)) {
    const normalized = normalizeCompanyName(valid[0].value!);
    return {
      value: normalized,
      confidence: Math.min(...valid.map((e) => e.confidence)) * 0.98,
      reason: "All extractors agree",
    };
  }

  // Pick highest confidence
  const best = valid.reduce((max, e) => (e.confidence > max.confidence ? e : max));
  const normalized = normalizeCompanyName(best.value!);

  return {
    value: normalized,
    confidence: best.confidence * 0.9,
    reason: `Highest confidence (${best.source})`,
  };
}

function normalizeCompanyName(name: string): string {
  const lower = name.toLowerCase().trim();
  return COMPANY_NORMALIZATIONS[lower] || name.trim();
}
