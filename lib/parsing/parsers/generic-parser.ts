/**
 * Generic Recruitment Email Parser (Enhanced)
 * 
 * Fallback parser for emails that don't match specific ATS platforms.
 * Uses regex patterns to extract common recruitment email structures.
 * 
 * Phase 2 Enhancements:
 * - Advanced interview link detection
 * - Salary extraction
 * - Timezone-aware date/time parsing
 * - Work location/mode extraction
 * - Interviewer email extraction
 */

import type { PlatformParser, ParserResult } from "../parser-interface";
import {
  extractDateTime,
  extractDeadline,
} from "../field-extractors/datetime-extractor";
import {
  extractInterviewLinks,
  selectPrimaryInterviewLink,
  hasInterviewSchedulingContent,
} from "../field-extractors/interview-link-extractor";
import { extractSalary } from "../field-extractors/salary-extractor";
import { classifyRecruitmentEvent, extractDeterministicFallbacks, extractExplicitDate, extractPlatformFields, isValidCompanyCandidate, isValidRoleCandidate, normalizeExtractedValue } from "../deterministic-fallbacks";

export class GenericParser implements PlatformParser {
  platformId = "generic";
  platformName = "Generic Recruitment Email";

  canHandle(): boolean {
    // Generic parser handles everything (used as fallback)
    return true;
  }

  parse(
    from: string,
    subject: string,
    body: string
  ): ParserResult | null {
    const fullText = `${subject}\n${body}`;
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();
    const lowerFull = fullText.toLowerCase();

    // ─── Event Type Detection (Enhanced) ───
    const classifiedEvent = classifyRecruitmentEvent(subject, from, body);
    const eventType = classifiedEvent.type;
    const eventConfidence = classifiedEvent.confidence;

    // ─── Company Name (Enhanced) ───
    let company: string | undefined;
    let companyConfidence = 0;

    const companyPatterns = [
      /(?:at|joining|applying to|applied at)\s+([A-Z][A-Za-z&\s]+?)(?:\s+for|\s+as|\s+to|\s+is|\.|,|$)/,
      /(?:from|on behalf of)\s+([A-Z][A-Za-z&\s]{3,40})(?:\s+(?:is|has|team))/i,
    ];

    for (const pattern of companyPatterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) {
        company = match[1].trim();
        companyConfidence = 0.65;
        break;
      }
    }

    // Try email domain
    if (!company) {
      const domainMatch = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
      if (domainMatch?.[1]) {
        const domain = domainMatch[1];
        // Skip known ATS domains
        if (!/workday|greenhouse|lever|ashby|indeed|noreply|mail/i.test(domain)) {
          company = domain.split(".")[0];
          companyConfidence = 0.45;
        }
      }
    }

    // ─── Role (Enhanced) ───
    let role: string | undefined;
    let roleConfidence = 0;

    const rolePatterns = [
      /for (?:the |a )?(?:position of |role of )?([^,.:\n]+)(?:\s+(?:position|role|job))?/i,
      /(?:position|role|applied for|applied to|job title)\s*:?\s*([^,.:\n]{5,60})/i,
      /^([A-Z][A-Za-z\s]+)\s+(?:position|role|job|opportunity)/i,
    ];

    for (const pattern of rolePatterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        // Skip if too generic
        if (!/^(?:job|position|role|opportunity|opening)$/i.test(candidate) && candidate.length > 3) {
          role = candidate;
          roleConfidence = 0.65;
          break;
        }
      }
    }

    // ─── Location (Enhanced) ───
    let location: string | undefined;
    let locationConfidence = 0;

    const locationPatterns = [
      /(?:location|based in|located in|position in|role in)\s*:?\s*([^,.:\n]{5,50})/i,
      /(?:in|at)[\s:]+((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*,?\s*)*[A-Z]{2})/i,
    ];

    for (const pattern of locationPatterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) {
        location = match[1].trim();
        locationConfidence = 0.6;
        break;
      }
    }

    // ─── Work Mode (New) ───
    let workMode: "remote" | "hybrid" | "onsite" | undefined;
    if (/remote|work from home|fully remote|work anywhere/i.test(body)) {
      workMode = "remote";
    } else if (/hybrid|mix of remote|flexible/i.test(body)) {
      workMode = "hybrid";
    } else if (/onsite|office|in-person|in-office/i.test(body)) {
      workMode = "onsite";
    }

    // ─── Interview Details (Enhanced with new extractors) ───
    const explicitDate = extractExplicitDate(fullText);
    const dateExtraction = eventType === "interview"
      ? extractDateTime(body, { sentDate: explicitDate || new Date() })
      : { confidence: 0, date: explicitDate, time: undefined, timezone: undefined };

    const links = extractInterviewLinks(body);
    const primaryLink = selectPrimaryInterviewLink(links);
    const hasInterviewContent = hasInterviewSchedulingContent(body);

    // ─── Salary (New) ───
    const salaryExtraction = eventType === "offer" ? extractSalary(body) : { confidence: 0 };

    // ─── Deadline (New) ───
    const deadlineExtraction = eventType === "offer" ? extractDeadline(body) : { confidence: 0 };

    // ─── Extract Interviewer Information (New) ───
    let interviewerName: string | undefined;
    let interviewerEmail: string | undefined;

    const interviewerMatch = body.match(/(?:with|interviewer|speak\s+with|from)\s+([A-Za-z\s]+?)(?:\n|,|\(|$)/i);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    const emailMatch = body.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch?.[1] && !emailMatch[1].includes("noreply")) {
      interviewerEmail = emailMatch[1];
    }

    // ─── Extract URLs ───
    let jobUrl: string | undefined;
    let careerPortalUrl: string | undefined;

    const allLinks = body.match(/https?:\/\/[^\s<>]+/gi) || [];
    if (allLinks.length > 0) {
      // Prefer job links
      const jobLink = allLinks.find(url => /job|apply|careers|position/i.test(url));
      jobUrl = jobLink || allLinks[0];

      if (allLinks.length > 1 && !jobLink) {
        careerPortalUrl = allLinks[1];
      }
    }

    // Deterministic platform rules run before generic heuristics to avoid template garbage.
    const platformFields = extractPlatformFields(from, subject, body);
    const fallback = extractDeterministicFallbacks(from, subject, body);
    company = (isValidCompanyCandidate(platformFields.company) ? platformFields.company : undefined)
      || (isValidCompanyCandidate(fallback.company) ? fallback.company : undefined)
      || (isValidCompanyCandidate(company) ? normalizeExtractedValue(company) : undefined);
    role = (isValidRoleCandidate(platformFields.role) ? platformFields.role : undefined)
      || (isValidRoleCandidate(fallback.role) ? fallback.role : undefined)
      || (isValidRoleCandidate(role) ? normalizeExtractedValue(role) : undefined);
    if (platformFields.location && !location) location = platformFields.location;
    const extractionSources = [
      platformFields.companySource && `company:${platformFields.companySource}`,
      platformFields.roleSource && `role:${platformFields.roleSource}`,
      fallback.company && !platformFields.company ? `company:${fallback.companySource || fallback.source}` : undefined,
      fallback.role && !platformFields.role ? `role:${fallback.roleSource || fallback.source}` : undefined,
    ].filter(Boolean) as string[];
    if (!jobUrl) jobUrl = fallback.jobUrl;
    if (!careerPortalUrl) careerPortalUrl = fallback.careerPortalUrl;
    if (company && companyConfidence === 0) companyConfidence = 0.42;
    if (role && roleConfidence === 0) roleConfidence = 0.42;

    // ─── Calculate Confidence ───
    const fieldsFound = [company, role, location, workMode].filter(Boolean).length;
    const baseConfidence = eventType === "update" ? 0.2 : 0.4;
    const parserConfidence = Math.min(0.75, baseConfidence + fieldsFound * 0.12);

    return {
      company: company ? { value: company, confidence: companyConfidence } : undefined,
      role: role ? { value: role, confidence: roleConfidence } : undefined,
      location: location ? { value: location, confidence: locationConfidence } : undefined,
      workMode: workMode ? { value: workMode, confidence: 0.8 } : undefined,
      eventType: { value: eventType as any, confidence: eventConfidence },
      eventDetails: {
        ...(dateExtraction.date && {
          interviewDate: { value: dateExtraction.date, confidence: dateExtraction.confidence },
        }),
        ...(dateExtraction.time && {
          interviewTime: { value: dateExtraction.time, confidence: dateExtraction.confidence },
        }),
        ...(dateExtraction.timezone && {
          timezone: { value: dateExtraction.timezone, confidence: 0.9 },
        }),
        ...(primaryLink && {
          interviewLink: { value: primaryLink.url, confidence: primaryLink.confidence },
          interviewLinkPlatform: { value: primaryLink.platform || "unknown", confidence: 0.9 },
        }),
        ...(interviewerName && {
          interviewerName: { value: interviewerName, confidence: 0.65 },
        }),
        ...(interviewerEmail && {
          interviewerEmail: { value: interviewerEmail, confidence: 0.85 },
        }),
        ...(deadlineExtraction.date && {
          deadline: { value: deadlineExtraction.date, confidence: deadlineExtraction.confidence },
        }),
        ...(salaryExtraction.maxSalary && {
          salary: {
            value: `${salaryExtraction.currency} ${salaryExtraction.minSalary || salaryExtraction.maxSalary} - ${salaryExtraction.maxSalary}`,
            confidence: salaryExtraction.confidence,
          },
          salaryMin: { value: salaryExtraction.minSalary, confidence: salaryExtraction.confidence },
          salaryMax: { value: salaryExtraction.maxSalary, confidence: salaryExtraction.confidence },
          salaryCurrency: { value: salaryExtraction.currency, confidence: 0.95 },
        }),
      },
      atsFields: {},
      rawPatternMatches: Object.fromEntries(extractionSources.map((source) => [source, source])),
      processingNotes: extractionSources,
      jobUrl,
      careerPortalUrl,
      parserConfidence,
      hasInterviewScheduling: hasInterviewContent,
    };
  }
}

export const genericParser = new GenericParser();
