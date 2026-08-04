/**
 * Enrichment Engine
 * 
 * Normalizes and enriches parsed data:
 * - Company name normalization (e.g., "Tesla Inc." → "Tesla")
 * - Field inference (e.g., infer location from company)
 * - Standardization (e.g., work mode: "WFH" → "remote")
 */

import type { ParserResult, ExtractedField } from "./parser-interface";

/**
 * Enrichment result.
 */
export interface EnrichedParserResult extends ParserResult {
  enrichedFields: {
    companyNormalized?: string;
    roleNormalized?: string;
  };
  enrichmentApplied: string[];
}

/**
 * Company name normalization patterns.
 * Removes common suffixes and standardizes names.
 */
const COMPANY_NORMALIZATIONS: [RegExp, string][] = [
  // Inc., Corp., etc.
  [/\s+(?:Inc\.?|Inc\.|Incorporated|Corp\.?|Corporation|Ltd\.?|Limited|LLC|L\.L\.C)$/i, ""],
  // Inc / Corp without period
  [/\s+(?:Inc|Corp|Ltd|LLC|AB|AG)$/i, ""],
  // Whitespace cleanup
  [/\s+/g, " "],
  // Trim
  [/^\s+|\s+$/g, ""],
];

/**
 * Normalize a company name.
 * 
 * @param company - Company name
 * @returns Normalized name
 */
export function normalizeCompanyName(company: string): string {
  if (!company) return "";

  let normalized = company.trim();

  for (const [pattern, replacement] of COMPANY_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

/**
 * Role normalization.
 * Standardizes common role variations.
 */
const ROLE_NORMALIZATIONS: Record<string, string> = {
  "sr.": "senior",
  "sr ": "senior",
  "jr.": "junior",
  "jr ": "junior",
  "eng.": "engineer",
  "mgmt": "management",
  "mgr": "manager",
  "dev": "developer",
  "devops": "devops engineer",
  "sde": "software developer",
  "swe": "software engineer",
  "qa": "quality assurance",
  "pm": "product manager",
  "dsa": "data scientist",
  "ds": "data scientist",
  "ml": "machine learning",
  "ai": "artificial intelligence",
  "ux": "user experience",
  "ui": "user interface",
  "fe": "frontend",
  "be": "backend",
  "infra": "infrastructure",
};

/**
 * Normalize a role title.
 * 
 * @param role - Role title
 * @returns Normalized title
 */
export function normalizeRole(role: string): string {
  if (!role) return "";

  let normalized = role.toLowerCase().trim();

  // Apply known normalizations
  for (const [key, value] of Object.entries(ROLE_NORMALIZATIONS)) {
    normalized = normalized.replace(new RegExp(`\\b${key}\\b`), value);
  }

  // Title case
  normalized = normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return normalized;
}

/**
 * Standardize work mode values.
 */
function normalizeWorkMode(
  workMode: string | undefined
): "remote" | "hybrid" | "onsite" | undefined {
  if (!workMode) return undefined;

  const lower = workMode.toLowerCase();

  if (/remote|wfh|work\s+from\s+home|fully\s+remote/.test(lower)) {
    return "remote";
  }

  if (/hybrid/.test(lower)) {
    return "hybrid";
  }

  if (/onsite|on[\s-]?site|in[\s-]?office|office/.test(lower)) {
    return "onsite";
  }

  return undefined;
}

/**
 * Infer missing fields from available data.
 * 
 * Examples:
 * - If location is missing but company is known, check company location DB
 * - If role is completely generic, mark for manual review
 * - If no interview date but assessment date exists, can infer timeline
 */
function inferMissingFields(result: ParserResult): Partial<ParserResult> {
  const inferred: Partial<ParserResult> = {};

  // If role is missing or generic, note for manual review
  if (!result.role || /^(?:job|position|role|opening)$/i.test(result.role.value)) {
    // Try to extract from subject
    // (This would require subject line to be passed — for now, just note it)
  }

  return inferred;
}

/**
 * Enrich parsed application data.
 * 
 * Performs:
 * - Company name normalization
 * - Role normalization
 * - Work mode standardization
 * - Field inference
 * 
 * @param parsed - Parsed result from parser
 * @returns Enriched result with normalization applied
 */
export function enrichParsedApplication(parsed: ParserResult): EnrichedParserResult {
  const enriched: EnrichedParserResult = {
    ...parsed,
    enrichedFields: {},
    enrichmentApplied: [],
  };

  // Normalize company
  if (parsed.company) {
    const normalized = normalizeCompanyName(parsed.company.value);
    if (normalized !== parsed.company.value) {
      enriched.enrichedFields.companyNormalized = normalized;
      enriched.enrichmentApplied.push("company_normalized");
    } else {
      enriched.enrichedFields.companyNormalized = normalized;
    }
  }

  // Normalize role
  if (parsed.role) {
    const normalized = normalizeRole(parsed.role.value);
    if (normalized !== parsed.role.value) {
      enriched.enrichedFields.roleNormalized = normalized;
      enriched.enrichmentApplied.push("role_normalized");
    } else {
      enriched.enrichedFields.roleNormalized = normalized;
    }
  }

  // Standardize work mode
  if (parsed.workMode) {
    const standardized = normalizeWorkMode(parsed.workMode.value);
    if (standardized) {
      enriched.workMode = {
        value: standardized,
        confidence: parsed.workMode.confidence * 0.9, // Slightly reduce confidence due to normalization
      };
      enriched.enrichmentApplied.push("workmode_standardized");
    }
  }

  // Infer missing fields
  const inferred = inferMissingFields(parsed);
  if (inferred.role && !parsed.role) {
    enriched.role = inferred.role;
    enriched.enrichmentApplied.push("role_inferred");
  }

  return enriched;
}

/**
 * Check if an enriched field should override the original.
 * 
 * Enrichment is conservative — only override if:
 * - Enrichment doesn't lose information
 * - Confidence remains reasonable
 */
export function shouldApplyEnrichment(
  original: ExtractedField<string> | undefined,
  enriched: string | undefined
): boolean {
  if (!enriched || !original) {
    return false;
  }

  // Never remove information
  if (enriched.length < original.value.length / 2) {
    return false;
  }

  return true;
}
