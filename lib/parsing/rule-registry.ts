/**
 * Centralized Rule Registry
 *
 * All extraction rules, regexes, and validation rules live here.
 * This separates business logic from execution logic.
 * Makes it easy to update rules without touching stage code.
 */

export interface ExtractionRule {
  name: string;
  pattern: RegExp | ((text: string) => string | null);
  confidence: number;
  priority: number; // Higher = better
  extractor: string; // Which stage/extractor found this
}

export interface ValidationRule {
  field: string;
  validate: (value: any) => boolean;
  errorMessage: string;
}

export const COMPANY_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "email_domain",
    pattern: /@([a-z0-9-]+)\.com/i,
    confidence: 0.95,
    priority: 100,
    extractor: "domain_parser",
  },
  {
    name: "hiring_team_from",
    pattern: /(?:from|sent by)\s+(?:the\s+)?(.+?)\s+(?:team|group|hiring)/i,
    confidence: 0.85,
    priority: 90,
    extractor: "regex_extractor",
  },
  {
    name: "subject_company",
    pattern: /^(.+?)\s*(?:–|:|—|\||offer|opportunity)/i,
    confidence: 0.75,
    priority: 80,
    extractor: "subject_parser",
  },
  {
    name: "application_confirmation",
    pattern: /(?:thank you|received)\s+your\s+application\s+(?:to|for)\s+(.+?)(?:\.|,|\s+for|\s+at)/i,
    confidence: 0.88,
    priority: 85,
    extractor: "confirmation_parser",
  },
];

export const ROLE_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "job_title_from_subject",
    pattern: /(?:for|position|role|opening|job)(?:\s+of|:|#)?\s+(.+?)(?:\s+at|\s+–|$)/i,
    confidence: 0.85,
    priority: 90,
    extractor: "subject_parser",
  },
  {
    name: "job_title_from_body",
    pattern: /(?:position|role|job|title):\s*(.+?)(?:\n|,|$)/i,
    confidence: 0.80,
    priority: 85,
    extractor: "body_parser",
  },
  {
    name: "interview_role",
    pattern: /interviewing\s+you\s+for\s+(?:the\s+)?(?:position|role)\s+(?:of\s+)?(.+?)(?:\.|,|\s+at)/i,
    confidence: 0.90,
    priority: 95,
    extractor: "interview_parser",
  },
];

export const SALARY_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "salary_range",
    pattern: /\$?([\d,]+)\s*(?:k|K)?\s*(?:–|-|to)\s*\$?([\d,]+)\s*(?:k|K)?(?:\s*(?:per year|\/year|annually|p\.a\.|USD|per annum))?/,
    confidence: 0.92,
    priority: 95,
    extractor: "salary_regex",
  },
  {
    name: "single_salary",
    pattern: /(?:salary|compensation|offer):\s*\$?([\d,]+)(?:k|K)?(?:\s*(?:per year|\/year|annually))?/i,
    confidence: 0.85,
    priority: 85,
    extractor: "compensation_parser",
  },
];

export const LOCATION_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "location_field",
    pattern: /(?:location|based in|office|located at):\s*(.+?)(?:\n|,|$)/i,
    confidence: 0.85,
    priority: 85,
    extractor: "body_parser",
  },
  {
    name: "city_state",
    pattern: /(?:,|\s)([A-Z][a-z]+),?\s+(?:[A-Z]{2}|[A-Z][a-z]+)(?:\s|,|$)/,
    confidence: 0.80,
    priority: 80,
    extractor: "location_parser",
  },
];

export const DATE_EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: "interview_date",
    pattern: /(?:interview|meeting|call)\s+(?:on|at|scheduled for)?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\w+\s+\d{1,2})/i,
    confidence: 0.90,
    priority: 90,
    extractor: "date_parser",
  },
  {
    name: "deadline",
    pattern: /(?:deadline|apply by|closing|closes):\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\w+\s+\d{1,2})/i,
    confidence: 0.88,
    priority: 88,
    extractor: "deadline_parser",
  },
];

export const VALIDATION_RULES: ValidationRule[] = [
  {
    field: "company",
    validate: (value) => value && value.length > 0 && value.length < 200,
    errorMessage: "Company name must be non-empty and under 200 chars",
  },
  {
    field: "role",
    validate: (value) => value && value.length > 0 && value.length < 200,
    errorMessage: "Role must be non-empty and under 200 chars",
  },
  {
    field: "salary",
    validate: (value) =>
      !value || (value.min >= 0 && value.max >= value.min && value.max < 10000000),
    errorMessage: "Salary range must be valid and realistic",
  },
];

export const DOCUMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  application_confirmation: [
    "thank you for applying",
    "received your application",
    "application received",
    "we received your application",
  ],
  assessment: [
    "please complete",
    "coding assessment",
    "take the test",
    "challenge",
    "assessment",
  ],
  interview_scheduling: [
    "would you be available",
    "can you interview",
    "schedule an interview",
    "let me know your availability",
    "book a meeting",
  ],
  interview_reminder: [
    "your interview is",
    "reminder: interview",
    "interview scheduled",
    "confirming your interview",
  ],
  offer: [
    "pleased to offer",
    "we would like to offer",
    "offer extended",
    "offer you the position",
    "we are delighted to offer",
  ],
  rejection: [
    "we decided to move forward",
    "not be moving forward",
    "decision to decline",
    "unfortunately",
    "we will not be proceeding",
  ],
};

export class RuleRegistry {
  private static instance: RuleRegistry;

  private constructor() {}

  static getInstance(): RuleRegistry {
    if (!RuleRegistry.instance) {
      RuleRegistry.instance = new RuleRegistry();
    }
    return RuleRegistry.instance;
  }

  getCompanyRules(): ExtractionRule[] {
    return COMPANY_EXTRACTION_RULES;
  }

  getRoleRules(): ExtractionRule[] {
    return ROLE_EXTRACTION_RULES;
  }

  getSalaryRules(): ExtractionRule[] {
    return SALARY_EXTRACTION_RULES;
  }

  getLocationRules(): ExtractionRule[] {
    return LOCATION_EXTRACTION_RULES;
  }

  getDateRules(): ExtractionRule[] {
    return DATE_EXTRACTION_RULES;
  }

  getValidationRules(): ValidationRule[] {
    return VALIDATION_RULES;
  }

  getDocumentTypeKeywords(docType: string): string[] {
    return DOCUMENT_TYPE_KEYWORDS[docType] || [];
  }

  /**
   * Register a custom rule at runtime.
   * Useful for adding ATS-specific rules without code changes.
   */
  registerCustomRule(fieldType: string, rule: ExtractionRule) {
    const ruleMap: Record<string, ExtractionRule[]> = {
      company: COMPANY_EXTRACTION_RULES,
      role: ROLE_EXTRACTION_RULES,
      salary: SALARY_EXTRACTION_RULES,
      location: LOCATION_EXTRACTION_RULES,
      date: DATE_EXTRACTION_RULES,
    };

    if (ruleMap[fieldType]) {
      ruleMap[fieldType].push(rule);
      // Sort by priority (highest first)
      ruleMap[fieldType].sort((a, b) => b.priority - a.priority);
    }
  }
}

export const ruleRegistry = RuleRegistry.getInstance();
