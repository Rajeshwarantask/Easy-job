/**
 * Validation Engine
 * 
 * Validates parsed application data and assigns confidence scores.
 * Ensures data quality and identifies fields that need manual review.
 */

import type { ParserResult } from "./parser-interface";

/**
 * Validation rule for a field.
 */
interface ValidationRule {
  name: string;
  validate: (value: any) => boolean;
  severity: "critical" | "warning"; // critical = blocks auto-save
}

/**
 * Validation result for a single field.
 */
interface FieldValidation {
  valid: boolean;
  value: any;
  confidence: number;
  issues: string[];
}

/**
 * Overall validation result.
 */
export interface ValidationResult {
  valid: boolean;
  criticalIssues: string[];
  warnings: string[];
  fieldValidations: Record<string, FieldValidation>;
  overallConfidence: number;
}

/**
 * Validation rules for each field type.
 */
const VALIDATION_RULES: Record<string, ValidationRule[]> = {
  company: [
    {
      name: "non-empty",
      validate: (v) => v && v.trim().length > 0,
      severity: "critical",
    },
    {
      name: "length",
      validate: (v) => v && v.length >= 2 && v.length <= 150,
      severity: "critical",
    },
    {
      name: "no-platform-name",
      validate: (v) => !/^(?:indeed|greenhouse|workday|lever|ashby|linkedin)$/i.test(v?.trim()),
      severity: "critical",
    },
  ],

  role: [
    {
      name: "length",
      validate: (v) => !v || (v.trim().length >= 3 && v.length <= 150),
      severity: "critical",
    },
    {
      name: "not-generic",
      validate: (v) => !v || !/^(?:job|position|role|opening)$/i.test(v?.trim()),
      severity: "warning",
    },
  ],

  location: [
    {
      name: "length",
      validate: (v) => !v || (v.trim().length >= 2 && v.length <= 100),
      severity: "warning",
    },
  ],

  eventType: [
    {
      name: "valid-type",
      validate: (v) => /^(?:applied|assessment|interview|offer|rejection|update)$/.test(v),
      severity: "critical",
    },
  ],
};

/**
 * Validate a single field against its rules.
 */
function validateField(
  fieldName: string,
  value: any,
  confidence: number
): FieldValidation {
  const rules = VALIDATION_RULES[fieldName] || [];
  const issues: string[] = [];

  for (const rule of rules) {
    if (!rule.validate(value)) {
      issues.push(`${fieldName}: ${rule.name}`);
    }
  }

  return {
    valid: issues.length === 0,
    value,
    confidence,
    issues,
  };
}

/**
 * Validate parsed application data.
 * 
 * Checks:
 * - All required fields are present and valid
 * - Field values meet format requirements
 * - Confidence scores are reasonable
 * 
 * @param parsed - Parsed application from parser
 * @returns Validation result with issues and confidence
 */
export function validateParsedApplication(parsed: ParserResult): ValidationResult {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const fieldValidations: Record<string, FieldValidation> = {};

  // Validate company (critical)
  if (parsed.company) {
    const validation = validateField(
      "company",
      parsed.company.value,
      parsed.company.confidence
    );
    fieldValidations.company = validation;
    if (!validation.valid) {
      validation.issues.forEach((issue) => {
        if (VALIDATION_RULES.company?.some((r) => r.name === issue.split(": ")[1] && r.severity === "critical")) {
          criticalIssues.push(issue);
        } else {
          warnings.push(issue);
        }
      });
    }
  } else {
    criticalIssues.push("company: missing");
  }

  // Validate role (warning if missing)
  if (parsed.role) {
    const validation = validateField(
      "role",
      parsed.role.value,
      parsed.role.confidence
    );
    fieldValidations.role = validation;
    if (!validation.valid) {
      validation.issues.forEach((issue) => {
        if (VALIDATION_RULES.role?.some((r) => r.name === issue.split(": ")[1] && r.severity === "critical")) {
          criticalIssues.push(issue);
        } else {
          warnings.push(issue);
        }
      });
    }
  } else {
    warnings.push("role: missing");
  }

  // Validate location (warning if invalid)
  if (parsed.location) {
    const validation = validateField(
      "location",
      parsed.location.value,
      parsed.location.confidence
    );
    fieldValidations.location = validation;
    if (!validation.valid) {
      validation.issues.forEach((issue) => warnings.push(issue));
    }
  }

  // Validate event type (critical)
  const eventValidation = validateField(
    "eventType",
    parsed.eventType.value,
    parsed.eventType.confidence
  );
  fieldValidations.eventType = eventValidation;
  if (!eventValidation.valid) {
    criticalIssues.push("eventType: invalid");
  }

  // Check low confidence scores
  if (parsed.company && parsed.company.confidence < 0.3) {
    warnings.push("company: very low confidence");
  }
  if (parsed.eventType.confidence < 0.3) {
    warnings.push("eventType: very low confidence");
  }

  // Calculate overall confidence
  const confidenceScores: number[] = [];
  if (parsed.company) confidenceScores.push(parsed.company.confidence);
  if (parsed.role) confidenceScores.push(parsed.role.confidence);
  if (parsed.location) confidenceScores.push(parsed.location.confidence);
  confidenceScores.push(parsed.eventType.confidence);
  confidenceScores.push(parsed.parserConfidence);

  const overallConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

  return {
    valid: criticalIssues.length === 0,
    criticalIssues,
    warnings,
    fieldValidations,
    overallConfidence,
  };
}

/**
 * Determine if parsed application should be auto-saved or requires manual review.
 * 
 * Auto-save if:
 * - No critical issues
 * - Overall confidence >= 0.6
 * - Company and eventType both >= 0.5 confidence
 * 
 * @param validation - Validation result
 * @returns true if should auto-save, false if requires manual review
 */
export function shouldAutoSave(validation: ValidationResult): boolean {
  if (validation.criticalIssues.length > 0) {
    return false;
  }

  if (validation.overallConfidence < 0.6) {
    return false;
  }

  // Check critical field confidence
  const companyValidation = validation.fieldValidations.company;
  const eventValidation = validation.fieldValidations.eventType;

  if (companyValidation && companyValidation.confidence < 0.5) {
    return false;
  }

  if (eventValidation && eventValidation.confidence < 0.5) {
    return false;
  }

  return true;
}

/**
 * Suggest required fields for manual review.
 */
export function suggestManualReview(validation: ValidationResult): string[] {
  const suggestions: string[] = [];

  if (validation.criticalIssues.length > 0) {
    suggestions.push("Critical validation issues detected");
  }

  if (validation.overallConfidence < 0.6) {
    suggestions.push("Low overall confidence — please review");
  }

  for (const [fieldName, fieldVal] of Object.entries(validation.fieldValidations)) {
    if (!fieldVal.valid && fieldVal.issues.length > 0) {
      suggestions.push(`${fieldName}: ${fieldVal.issues.join(", ")}`);
    }
  }

  return suggestions;
}
