/**
 * Workday Platform Parser (Enhanced)
 * 
 * Extracts structured data from Workday recruitment emails.
 * Handles: application updates, interview scheduling, offers, and status changes.
 * 
 * Phase 2 Enhancements:
 * - Candidate/application ID extraction
 * - Advanced date/time parsing with timezone
 * - Interview link platform detection
 * - Salary range extraction
 * - Offer deadline parsing
 * - Work location/mode extraction
 */

import type { PlatformParser, ParserResult } from "../parser-interface";
import {
  extractDateTime,
  extractDeadline,
} from "../field-extractors/datetime-extractor";
import {
  extractInterviewLinks,
  selectPrimaryInterviewLink,
} from "../field-extractors/interview-link-extractor";
import { extractSalary } from "../field-extractors/salary-extractor";

export class WorkdayParser implements PlatformParser {
  platformId = "workday";
  platformName = "Workday";

  canHandle(from: string, subject: string): boolean {
    return /workday/.test(from) || /workday/i.test(subject);
  }

  parse(
    from: string,
    subject: string,
    body: string
  ): ParserResult | null {
    const fullText = `${subject}\n${body}`;
    const lowerBody = body.toLowerCase();

    // ─── Event Type (Enhanced) ───
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|application.*submitted|thank.*you.*application/i.test(fullText)) {
      eventType = "applied";
      eventConfidence = 0.85;
    } else if (/interview.*scheduled|interview.*invitation|interview.*date|interview time|interview confirmed/i.test(fullText)) {
      eventType = "interview";
      eventConfidence = 0.9;
    } else if (/offer|congratulation|offer.*letter|you.{0,10}selected|extended.*offer|job.*offer/i.test(fullText)) {
      eventType = "offer";
      eventConfidence = 0.9;
    } else if (/unfortunately|regret|not.*selected|rejected|application.*closed|not moving forward/i.test(fullText)) {
      eventType = "rejection";
      eventConfidence = 0.85;
    } else if (/assessment|test|screening|questionnaire|take.*test|complete.*assessment/i.test(fullText)) {
      eventType = "assessment";
      eventConfidence = 0.8;
    }

    // ─── Company (Enhanced) ───
    let company: string | undefined;
    let companyConfidence = 0.65;

    const companyPatterns = [
      /(?:job\s+)?application\s+(?:for|at|with)\s+([A-Z][A-Za-z&\s]+?)(?:\n|,|$)/i,
      /(?:at|from)\s+([A-Z][A-Za-z&\s]{3,40})(?:\s+(?:is|has|for))/i,
    ];

    for (const pattern of companyPatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        company = match[1].trim();
        companyConfidence = 0.75;
        break;
      }
    }

    // ─── Role (Enhanced) ───
    let role: string | undefined;
    let roleConfidence = 0.6;

    const rolePatterns = [
      /(?:position|job|role)\s*:?\s*([^,\n]{5,50})/i,
      /Applied for\s+([^,\n]+)/i,
    ];

    for (const pattern of rolePatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        if (!/^(?:job|position|role)$/i.test(candidate)) {
          role = candidate;
          roleConfidence = 0.75;
          break;
        }
      }
    }

    // ─── Location ───
    let location: string | undefined;
    let locationConfidence = 0;
    const locationMatch = body.match(/(?:location|office|based in|position in)\s*:?\s*([^,\n]{3,50})/i);
    if (locationMatch?.[1]) {
      location = locationMatch[1].trim();
      locationConfidence = 0.7;
    }

    // ─── Work Mode ───
    let workMode: "remote" | "hybrid" | "onsite" | undefined;
    if (/remote|work from home|fully remote|work anywhere/i.test(body)) {
      workMode = "remote";
    } else if (/hybrid|mix of remote|flexible/i.test(body)) {
      workMode = "hybrid";
    } else if (/onsite|office|in-person|on-site/i.test(body)) {
      workMode = "onsite";
    }

    // ─── Workday-Specific IDs (Enhanced) ───
    let requisitionId: string | undefined;
    let applicationId: string | undefined;
    let candidateId: string | undefined;

    const reqIdMatch = body.match(/requisition\s+(?:id|#|number)[\s:]*([A-Za-z0-9-]+)/i);
    if (reqIdMatch?.[1]) {
      requisitionId = reqIdMatch[1];
    }

    const appIdMatch = body.match(/application\s+(?:id|#|number)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    const candidateMatch = body.match(/candidate\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (candidateMatch?.[1]) {
      candidateId = candidateMatch[1];
    }

    // Try Workday URL patterns
    if (!requisitionId) {
      const urlReqMatch = body.match(/\/jobs\/([A-Za-z0-9-]+)/i);
      if (urlReqMatch?.[1]) {
        requisitionId = urlReqMatch[1];
      }
    }

    // ─── Interview Details (Enhanced) ───
    const dateExtraction = eventType === "interview"
      ? extractDateTime(body, { sentDate: new Date() })
      : { confidence: 0 };

    const links = extractInterviewLinks(body);
    const primaryLink = selectPrimaryInterviewLink(links);

    // ─── Salary (New) ───
    const salaryExtraction = eventType === "offer" ? extractSalary(body) : { confidence: 0 };

    // ─── Offer Deadline (New) ───
    const deadlineExtraction = eventType === "offer" ? extractDeadline(body) : { confidence: 0 };

    // ─── Career Portal URL ───
    let careerPortalUrl: string | undefined;
    const portalMatch = body.match(/https?:\/\/[^\s<>]*workday\.com[^\s<>]*/i);
    if (portalMatch) {
      careerPortalUrl = portalMatch[0];
    }

    // Calculate overall confidence
    const fieldsFound = [company, role, location, requisitionId, applicationId].filter(Boolean).length;
    const baseConfidence = 0.75;
    const parserConfidence = Math.min(0.95, baseConfidence + fieldsFound * 0.04);

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
      atsFields: {
        requisitionId,
        applicationId,
        candidateId,
      },
      careerPortalUrl,
      parserConfidence,
    };
  }
}

export const workdayParser = new WorkdayParser();
