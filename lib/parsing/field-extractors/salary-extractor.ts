/**
 * Salary Extraction Module
 * 
 * Handles extraction of salary information from recruitment emails.
 * Supports various formats: $100k, $100,000, £50k, €60k, etc.
 */

export interface SalaryExtraction {
  minSalary?: number;
  maxSalary?: number;
  salaryText?: string; // Original text (e.g., "$100k - $120k")
  currency?: string; // "USD", "GBP", "EUR", etc.
  frequency?: "annual" | "hourly" | "contract"; // How often is this paid?
  confidence: number; // 0-1
}

// Currency symbol to code mapping
const CURRENCY_CODES: Record<string, string> = {
  $: "USD",
  £: "GBP",
  €: "EUR",
  "C$": "CAD",
  A$: "AUD",
  ¥: "JPY",
  ₹: "INR",
  "kr": "SEK",
};

// Common abbreviations to multipliers
const ABBREVIATION_MULTIPLIERS: Record<string, number> = {
  k: 1000,
  K: 1000,
  m: 1000000,
  M: 1000000,
};

/**
 * Extract salary ranges from email body.
 * Handles formats like:
 * - $100k - $120k
 * - $100,000 to $120,000
 * - Salary: $100k+
 * - up to $150k
 */
export function extractSalary(bodyText: string): SalaryExtraction {
  const text = bodyText || "";
  let confidence = 0;
  let minSalary: number | undefined;
  let maxSalary: number | undefined;
  let currency: string | undefined;
  let salaryText: string | undefined;
  let frequency: "annual" | "hourly" | "contract" = "annual";

  // Pattern 1: "$X - $Y" or "$X to $Y" format
  const rangePattern = /([£$€])\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K|m|M)?\s*(?:to|-|–)\s*\1?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K|m|M)?/i;
  const rangeMatch = text.match(rangePattern);

  if (rangeMatch) {
    const [fullMatch, currencySymbol, min, max] = rangeMatch;
    currency = CURRENCY_CODES[currencySymbol] || "USD";
    minSalary = parseNumericValue(min);
    maxSalary = parseNumericValue(max);
    salaryText = fullMatch.trim();
    confidence = 0.8;
  }

  // Pattern 2: "Salary: $X" or "Annual salary $X"
  if (!salaryText) {
    const singlePattern = /(?:salary|compensation|pay)[\s:]*(?:up to |upto |up to )?([£$€])\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K|m|M)?/i;
    const singleMatch = text.match(singlePattern);

    if (singleMatch) {
      const [fullMatch, currencySymbol, amount] = singleMatch;
      currency = CURRENCY_CODES[currencySymbol] || "USD";
      maxSalary = parseNumericValue(amount);
      salaryText = fullMatch.trim();
      confidence = 0.7;
    }
  }

  // Pattern 3: Look for hourly rate ($X/hour or $X per hour)
  if (!salaryText) {
    const hourlyPattern = /([£$€])\s*(\d{1,3}(?:\.\d{2})?)\s*(?:\/|per)\s*(?:hour|hr)/i;
    const hourlyMatch = text.match(hourlyPattern);

    if (hourlyMatch) {
      const [fullMatch, currencySymbol, amount] = hourlyMatch;
      currency = CURRENCY_CODES[currencySymbol] || "USD";
      maxSalary = parseFloat(amount.replace(/,/g, ""));
      salaryText = fullMatch.trim();
      frequency = "hourly";
      confidence = 0.85;
    }
  }

  // Try to extract abbreviation multiplier if we found a salary without it
  if (salaryText && !minSalary && !maxSalary) {
    const abbreviationPattern = /(\d+)\s*([kKmM])/;
    const match = text.match(abbreviationPattern);
    if (match) {
      const value = parseInt(match[1]);
      const multiplier = ABBREVIATION_MULTIPLIERS[match[2]] || 1;
      maxSalary = value * multiplier;
    }
  }

  return {
    minSalary,
    maxSalary,
    salaryText,
    currency: currency || "USD",
    frequency,
    confidence,
  };
}

/**
 * Parse a numeric value that might have commas or abbreviations.
 * Examples: "100,000" -> 100000, "100k" -> 100000
 */
function parseNumericValue(value: string): number {
  // Remove commas
  const cleaned = value.replace(/,/g, "");

  // Check for abbreviation (k, m, etc)
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kKmM])$/);
  if (match) {
    const num = parseFloat(match[1]);
    const multiplier = ABBREVIATION_MULTIPLIERS[match[2]] || 1;
    return num * multiplier;
  }

  return parseFloat(cleaned);
}

/**
 * Format salary for display.
 */
export function formatSalary(extraction: SalaryExtraction): string {
  if (!extraction.minSalary && !extraction.maxSalary) {
    return extraction.salaryText || "Unknown";
  }

  const prefix = extraction.currency === "USD" ? "$" : extraction.currency + " ";
  const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  if (extraction.minSalary && extraction.maxSalary) {
    return `${prefix}${formatter.format(extraction.minSalary)} - ${prefix}${formatter.format(
      extraction.maxSalary
    )}`;
  }

  if (extraction.maxSalary) {
    return `${prefix}${formatter.format(extraction.maxSalary)}`;
  }

  if (extraction.minSalary) {
    return `${prefix}${formatter.format(extraction.minSalary)}`;
  }

  return extraction.salaryText || "Unknown";
}
