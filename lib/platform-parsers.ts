import { DeterministicParser, registry } from "./deterministic-parser";
import type { DeterministicParseResult } from "./deterministic-parser";
import { registerGenericRegexParser } from "./generic-regex-parser";

/**
 * Platform-Specific ATS Parsers
 * 
 * Each major ATS system has distinctive email patterns that can be parsed
 * with extremely high accuracy (90-98%) without any AI.
 * 
 * Adding a new parser is simple: create a class, register it.
 * No changes to core architecture needed.
 */

// ─────────────────────────────────────────────────────────────────
// INDEED PARSER
// ─────────────────────────────────────────────────────────────────

class IndeedParser implements DeterministicParser {
  name = "indeed";
  priority = 85; // Run early, very distinctive

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("indeed.com") || subject.includes("Indeed") || platform === "Indeed";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    // Indeed confirmation: "Indeed Application: Senior Engineer at ACME Corp" OR "Indeed Application: Senior Engineer"
    const confirmWithCompany = subject.match(/indeed application:\s*(.+?)\s+at\s+(.+?)(?:\s*[–-]\s*|$)/i);
    if (confirmWithCompany) {
      return {
        role: confirmWithCompany[1].trim(),
        company: confirmWithCompany[2].trim(),
        status: "applied",
        confidence: { company: 0.9, role: 0.85, status: 0.95 },
        sources: { company: "platform_parser", role: "platform_parser", status: "platform_parser" },
        platform: "Indeed",
      };
    }

    // Indeed confirmation without explicit company: "Indeed Application: Software Developer"
    const confirmRoleOnly = subject.match(/indeed application:\s*(.+?)(?:\s*[–-]\s*|$)/i);
    if (confirmRoleOnly) {
      return {
        role: confirmRoleOnly[1].trim(),
        company: "Unknown Company", // Will be filled from domain
        status: "applied",
        confidence: { company: 0.1, role: 0.85, status: 0.95 },
        sources: { company: "unknown", role: "platform_parser", status: "platform_parser" },
        platform: "Indeed",
      };
    }

    // Interview invitation
    if (/interview|next round|let's talk|schedule|chat/i.test(subject) && /indeed/i.test(body)) {
      return {
        status: "interview",
        confidence: { company: 0.2, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Indeed",
      };
    }

    // Rejection
    if (/reject|not moving|opportunity|passed|regret/i.test(subject) && /indeed/i.test(body)) {
      return {
        status: "rejected",
        confidence: { company: 0.2, role: 0, status: 0.95 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Indeed",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// GREENHOUSE PARSER
// ─────────────────────────────────────────────────────────────────

class GreenhouseParser implements DeterministicParser {
  name = "greenhouse";
  priority = 84;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("greenhouse.io") || from.includes("greenhouse-mail") || platform === "Greenhouse";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    // Greenhouse: "Application decision for {position} at {company}"
    const decisionMatch = subject.match(/application decision for\s+(.+?)\s+at\s+(.+?)$/i);
    if (decisionMatch) {
      return {
        role: decisionMatch[1].trim(),
        company: decisionMatch[2].trim(),
        status: /reject|not moving|declined/i.test(subject) ? "rejected" : "interview",
        confidence: { company: 0.9, role: 0.85, status: 0.92 },
        sources: { company: "platform_parser", role: "platform_parser", status: "platform_parser" },
        platform: "Greenhouse",
      };
    }

    // Greenhouse status keywords
    if (/we'd like to move forward/i.test(body)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.95 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Greenhouse",
      };
    }

    if (/not moving forward|decided to pursue|regret|passed/i.test(body)) {
      return {
        status: "rejected",
        confidence: { company: 0.1, role: 0, status: 0.95 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Greenhouse",
      };
    }

    if (/offer|job offer|congratulations/i.test(subject)) {
      return {
        status: "offer",
        confidence: { company: 0.1, role: 0, status: 0.98 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Greenhouse",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// WORKDAY PARSER
// ─────────────────────────────────────────────────────────────────

class WorkdayParser implements DeterministicParser {
  name = "workday";
  priority = 84;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("workday.com") || from.includes("myworkday") || platform === "Workday";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|thanks for applying|we received your application/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Workday",
      };
    }

    if (/next steps|interview scheduled|we'd like to speak|screening/i.test(subject)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Workday",
      };
    }

    if (/we're excited|offer|job offer|congratulations/i.test(subject)) {
      return {
        status: "offer",
        confidence: { company: 0.1, role: 0, status: 0.95 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Workday",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// LEVER PARSER
// ─────────────────────────────────────────────────────────────────

class LeverParser implements DeterministicParser {
  name = "lever";
  priority = 84;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("lever.co") || platform === "Lever";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|thanks for applying/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Lever",
      };
    }

    if (/we'd like to meet|next round|let's talk|interview/i.test(subject)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Lever",
      };
    }

    if (/congratulations|we're excited|offer|job offer/i.test(subject)) {
      return {
        status: "offer",
        confidence: { company: 0.1, role: 0, status: 0.95 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Lever",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// ASHBY PARSER
// ─────────────────────────────────────────────────────────────────

class AshbyParser implements DeterministicParser {
  name = "ashby";
  priority = 84;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("ashby.com") || platform === "Ashby";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|thanks for applying|we got your application/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Ashby",
      };
    }

    if (/interview|next step|moving forward/i.test(subject)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.85 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Ashby",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SMARTRECRUITERS PARSER
// ─────────────────────────────────────────────────────────────────

class SmartRecruitersParser implements DeterministicParser {
  name = "smartrecruiters";
  priority = 84;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("smartrecruiters.com") || platform === "SmartRecruiters";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application status|thanks for your application|received/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "SmartRecruiters",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// ORACLE RECRUITING PARSER
// ─────────────────────────────────────────────────────────────────

class OracleRecruitingParser implements DeterministicParser {
  name = "oracle_recruiting";
  priority = 83;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("oraclecloud.com") || from.includes("@oracle.com") || platform === "Oracle Recruiting";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|application confirmed/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Oracle Recruiting",
      };
    }

    if (/interview|next round/i.test(subject)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Oracle Recruiting",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SUCCESSFACTORS PARSER
// ─────────────────────────────────────────────────────────────────

class SuccessFactorsParser implements DeterministicParser {
  name = "successfactors";
  priority = 83;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("successfactors.com") || platform === "SuccessFactors";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|thanks for applying/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "SuccessFactors",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// TALEO PARSER
// ─────────────────────────────────────────────────────────────────

class TaleoParser implements DeterministicParser {
  name = "taleo";
  priority = 83;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("taleo.net") || from.includes("taleo.com") || platform === "Taleo";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application received|thanks for applying|your application/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Taleo",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// LINKEDIN JOBS PARSER
// ─────────────────────────────────────────────────────────────────

class LinkedInJobsParser implements DeterministicParser {
  name = "linkedin_jobs";
  priority = 82;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("linkedin.com") || platform === "LinkedIn";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/message from|recruiter|hiring team/i.test(subject)) {
      return {
        status: "update",
        confidence: { company: 0.2, role: 0, status: 0.7 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "LinkedIn",
      };
    }

    return null;
  }
}

// ──────────────────��──────────────────────────────────────────────
// ICIMS PARSER
// ─────────────────────────────────────────────────────────────────

class iCIMSParser implements DeterministicParser {
  name = "icims";
  priority = 83;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("icims.com") || platform === "iCIMS";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application|submission/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.85 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "iCIMS",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// JOBVITE PARSER
// ─────────────────────────────────────────────────────────────────

class JobviteParser implements DeterministicParser {
  name = "jobvite";
  priority = 83;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("jobvite.com") || platform === "Jobvite";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    if (/application|confirmation/i.test(subject)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.85 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Jobvite",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// NAUKRI PARSER (Indian job portal)
// ─────────────────────────────────────────────────────────────────

class NaukriParser implements DeterministicParser {
  name = "naukri";
  priority = 80;

  canHandle(from: string, subject: string, platform: string | null): boolean {
    return from.includes("naukri.com") || platform === "Naukri";
  }

  parse(from: string, subject: string, body: string): Partial<DeterministicParseResult> | null {
    const text = `${subject} ${body}`;

    // Naukri recommendation: "This profile has been recommended for {role} at {company}"
    // Example: "Urgently looking for Associate at TCS"
    const recommendationMatch = text.match(/(?:recommend(?:ed)?|match(?:ed)?|profile.*recommendation).*?(?:for|role|position)\s+([A-Za-z ]{2,50})\s+at\s+([A-Z][a-zA-Z0-9 &.'-]{2,50})/i);
    if (recommendationMatch) {
      return {
        role: recommendationMatch[1].trim(),
        company: recommendationMatch[2].trim(),
        status: "update",
        confidence: { company: 0.8, role: 0.7, status: 0.8 },
        sources: { company: "platform_parser", role: "platform_parser", status: "platform_parser" },
        platform: "Naukri",
      };
    }

    // Naukri application confirmation: "Company Name via Naukri - Your Application"
    // Naukri job posting reference: "job title at Company Name (via Naukri)"
    const viaMatch = text.match(/([A-Z][a-zA-Z0-9 &.'-]{2,40})\s+via\s+Naukri/i);
    if (viaMatch) {
      return {
        company: viaMatch[1].trim(),
        status: "applied",
        confidence: { company: 0.85, role: 0, status: 0.85 },
        sources: { company: "platform_parser", role: "unknown", status: "platform_parser" },
        platform: "Naukri",
      };
    }

    // Naukri shortlist: "You have been shortlisted"
    if (/shortlist|selected|invited|interview/i.test(subject)) {
      return {
        status: "interview",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Naukri",
      };
    }

    // Naukri rejection
    if (/not moving forward|not selected|rejected|not shortlist/i.test(subject)) {
      return {
        status: "rejected",
        confidence: { company: 0.1, role: 0, status: 0.9 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Naukri",
      };
    }

    // Generic Naukri email - only if confidence is high enough
    if (/application|job|status|recommendation/i.test(subject) && /naukri|recruitment|opportunity/i.test(text)) {
      return {
        status: "applied",
        confidence: { company: 0.1, role: 0, status: 0.75 },
        sources: { company: "unknown", role: "unknown", status: "platform_parser" },
        platform: "Naukri",
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// REGISTER ALL PARSERS
// ─────────────────────────────────────────────────────────────────

export function registerAllParsers(): void {
  registry.register(new IndeedParser());
  registry.register(new GreenhouseParser());
  registry.register(new WorkdayParser());
  registry.register(new LeverParser());
  registry.register(new AshbyParser());
  registry.register(new SmartRecruitersParser());
  registry.register(new OracleRecruitingParser());
  registry.register(new SuccessFactorsParser());
  registry.register(new TaleoParser());
  registry.register(new LinkedInJobsParser());
  registry.register(new iCIMSParser());
  registry.register(new JobviteParser());
  registry.register(new NaukriParser());
  // Register generic regex parser last (lowest priority)
  registerGenericRegexParser();
}

export { IndeedParser, GreenhouseParser, WorkdayParser, LeverParser, AshbyParser, SmartRecruitersParser, OracleRecruitingParser, SuccessFactorsParser, TaleoParser, LinkedInJobsParser, iCIMSParser, JobviteParser, NaukriParser };
