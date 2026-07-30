/**
 * Platform-specific deterministic parsers for major ATS systems.
 * These extract structured data without AI for common email patterns.
 * Each parser returns null if the email doesn't match the platform's known format.
 */

import type { ParsedEmail } from "./email-parser";

// ─────────────────────────────────────────────
// INDEED PARSER
// ─────────────────────────────────────────────
export function parseIndeedEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@indeed.com") && !from.includes("indeedapply@")) return null;

  const isApplication = /indeed\s+application/i.test(subject);
  if (!isApplication) return null;

  // Extract role from subject: "Indeed Application: [Role]"
  const roleMatch = subject.match(/application:\s*([^|]+)/i);
  const role = roleMatch ? roleMatch[1].trim() : null;

  return {
    company: "Indeed", // Placeholder — role is in subject
    company_confidence: 0.5,
    company_reasoning: "Email from Indeed platform",
    role: role ?? undefined,
    eventType: "applied",
    status_confidence: 0.9,
    status_reasoning: "Indeed confirmation email format",
    parsedBy: "rules",
  };
}

// ─────────────────────────────────────────────
// GREENHOUSE PARSER
// ─────────────────────────────────────────────
export function parseGreenhouseEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@greenhouse.io") && !from.includes("greenhouse")) return null;

  // Greenhouse status keywords in subject
  if (/we'd like to move forward/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Greenhouse email, company not in subject",
      role: undefined,
      eventType: "interview",
      status_confidence: 0.95,
      status_reasoning: "Greenhouse 'move forward' language indicates interview stage",
      parsedBy: "rules",
    };
  }

  if (/rejection|not moving forward|decided to go|opportunity has passed/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Greenhouse email, company not in subject",
      role: undefined,
      eventType: "rejected",
      status_confidence: 0.95,
      status_reasoning: "Greenhouse rejection language",
      parsedBy: "rules",
    };
  }

  if (/offer|job offer|pleased to offer|congratulations/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Greenhouse email, company not in subject",
      role: undefined,
      eventType: "offer",
      status_confidence: 0.95,
      status_reasoning: "Greenhouse offer language",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// WORKDAY PARSER
// ─────────────────────────────────────────────
export function parseWorkdayEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@workday.com") && !from.includes("workday")) return null;

  // Workday confirmation of application submission
  if (/application received|application confirmed|we received your application/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Workday email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "Workday application confirmation",
      parsedBy: "rules",
    };
  }

  if (/next steps|interview scheduled|we'd like to speak|screening call/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Workday email, company not in subject",
      role: undefined,
      eventType: "interview",
      status_confidence: 0.9,
      status_reasoning: "Workday interview scheduling language",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// LEVER PARSER
// ─────────────────────────────────────────────
export function parseLeverEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@lever.co") && !from.includes("lever")) return null;

  if (/we'd like to meet|next round|let's talk|interview scheduled/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Lever email, company not in subject",
      role: undefined,
      eventType: "interview",
      status_confidence: 0.9,
      status_reasoning: "Lever interview invitation language",
      parsedBy: "rules",
    };
  }

  if (/congratulations|we're excited|offer|job offer/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Lever email, company not in subject",
      role: undefined,
      eventType: "offer",
      status_confidence: 0.95,
      status_reasoning: "Lever offer language",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// ASHBY PARSER
// ─────────────────────────────────────────────
export function parseAshbyEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@ashby.ai") && !from.includes("ashby")) return null;

  if (/application received|thanks for applying|we got your application/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Ashby email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "Ashby application confirmation",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// SMARTRECRUITERS PARSER
// ─────────────────────────────────────────────
export function parseSmartRecruitersEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("@smartrecruiters.com") && !from.includes("smartrecruiters")) return null;

  if (/application status|thanks for your application|application received/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "SmartRecruiters email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "SmartRecruiters application confirmation",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// ORACLE RECRUITING PARSER
// ─────────────────────────────────────────────
export function parseOracleRecruitingEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("oraclecloud.com") && !from.includes("@oracle.com")) return null;

  if (/application received|application confirmed|we received your application/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Oracle Recruiting email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "Oracle application confirmation",
      parsedBy: "rules",
    };
  }

  if (/interview scheduled|interview invitation|let's meet/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Oracle Recruiting email, company not in subject",
      role: undefined,
      eventType: "interview",
      status_confidence: 0.9,
      status_reasoning: "Oracle interview scheduling",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// SUCCESSFACTORS PARSER
// ─────────────────────────────────────────────
export function parseSuccessFactorsEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("successfactors.com")) return null;

  if (/application received|thanks for applying/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "SuccessFactors email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "SuccessFactors application confirmation",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// TALEO PARSER
// ─────────────────────────────────────────────
export function parseTaleoEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("taleo.net") && !from.includes("taleo.com")) return null;

  if (/application received|thanks for applying|your application/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "Taleo email, company not in subject",
      role: undefined,
      eventType: "applied",
      status_confidence: 0.9,
      status_reasoning: "Taleo application confirmation",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// LINKEDIN JOBS PARSER
// ─────────────────────────────────────────────
export function parseLinkedInJobsEmail(
  from: string,
  subject: string,
  body: string
): ParsedEmail | null {
  if (!from.includes("linkedin.com")) return null;

  if (/message from hiring team|message from recruiter|message from|job alert/i.test(subject)) {
    return {
      company: "Unknown Company",
      company_confidence: 0.1,
      company_reasoning: "LinkedIn email, company not in subject",
      role: undefined,
      eventType: "update",
      status_confidence: 0.7,
      status_reasoning: "LinkedIn message or job alert",
      parsedBy: "rules",
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// DISPATCHER — try platform-specific parsers
// ─────────────────────────────────────────────

export function parsePlatformSpecific(
  from: string,
  subject: string,
  body: string,
  platform: string | null
): ParsedEmail | null {
  // Platform detected — try the matching parser first
  if (platform === "Indeed") return parseIndeedEmail(from, subject, body);
  if (platform === "Greenhouse") return parseGreenhouseEmail(from, subject, body);
  if (platform === "Workday") return parseWorkdayEmail(from, subject, body);
  if (platform === "Lever") return parseLeverEmail(from, subject, body);
  if (platform === "Ashby") return parseAshbyEmail(from, subject, body);
  if (platform === "SmartRecruiters") return parseSmartRecruitersEmail(from, subject, body);
  if (platform === "Oracle" || platform?.includes("Oracle")) return parseOracleRecruitingEmail(from, subject, body);
  if (platform === "SuccessFactors") return parseSuccessFactorsEmail(from, subject, body);
  if (platform === "Taleo") return parseTaleoEmail(from, subject, body);
  if (platform === "LinkedIn") return parseLinkedInJobsEmail(from, subject, body);

  return null;
}
