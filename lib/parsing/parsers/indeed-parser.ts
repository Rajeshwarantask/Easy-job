/**
 * Indeed Platform Parser (Enhanced)
 * 
 * Extracts structured data from Indeed recruitment emails.
 * Handles: application confirmation, next steps, interview scheduling, offers.
 * 
 * Phase 2 Enhancements:
 * - Advanced date/time parsing with timezone support
 * - Interview link detection (Zoom, Google Meet, Teams, etc.)
 * - Salary extraction ($X - $Y ranges)
 * - Better event type detection
 * - Improved role and company extraction
 */

import type { PlatformParser, ParserResult } from "../parser-interface";
import {
  extractDateTime,
  extractDeadline,
  type DateTimeExtraction,
} from "../field-extractors/datetime-extractor";
import {
  extractInterviewLinks,
  selectPrimaryInterviewLink,
  hasInterviewSchedulingContent,
} from "../field-extractors/interview-link-extractor";
import {
  extractSalary,
  type SalaryExtraction,
} from "../field-extractors/salary-extractor";

export class IndeedParser implements PlatformParser {
  platformId = "indeed";
  platformName = "Indeed";

  canHandle(from: string, subject: string): boolean {
    return /indeed/i.test(from) || /indeed/i.test(subject);
  }

  parse(
    from: string,
    subject: string,
    body: string
  ): ParserResult | null {
    const fullText = `${subject}\n${body}`;
    const lowerBody = body.toLowerCase();

    // ─── Event Type Detection (Enhanced) ───
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|thank.*for.*applying|your application/i.test(fullText)) {
      eventType = "applied";
      eventConfidence = 0.85;
    } else if (/interview.*scheduled|next.*step|invited.*to.*interview|schedule.*interview|confirm.*interview/i.test(fullText)) {
      eventType = "interview";
      eventConfidence = 0.85;
    } else if (/offer|congratulation|you.*selected|job offer|we.{0,20}pleased|job is yours/i.test(fullText)) {
      eventType = "offer";
      eventConfidence = 0.9;
    } else if (/unfortunately|regret|not.*moving|rejected|not selected|not selected|you were not selected/i.test(fullText)) {
      eventType = "rejection";
      eventConfidence = 0.85;
    } else if (/assessment|test|screening|coding.*challenge|take.*test|assessment.*link/i.test(fullText)) {
      eventType = "assessment";
      eventConfidence = 0.8;
    }

    // ─── Company Extraction (Enhanced) ───
    let company: string | undefined;
    let companyConfidence = 0.6;

    // Indeed usually includes company in subject or early body
    const companyPatterns = [
      /(?:for|at|position at|company:?)\s*\(?([A-Z][A-Za-z&\s]+?)\)?[\n,]/,
      /(?:at)\s+([A-Z][A-Za-z&\s]{3,40})(?:\s+(?:position|role|is hiring))/i,
    ];

    for (const pattern of companyPatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        company = match[1].trim();
        companyConfidence = 0.75;
        break;
      }
    }

    // ─── Role Extraction (Enhanced) ───
    let role: string | undefined;
    let roleConfidence = 0.5;

    const rolePatterns = [
      /(?:position|role|job title|title|for the role of):?\s*\(?([A-Z][A-Za-z\s&-]{3,50})\)?(?:\s+(?:position|role|job))?/i,
      /Applied for:?\s+([A-Z][A-Za-z\s&-]{3,50})/i,
    ];

    for (const pattern of rolePatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        if (!/^(?:job|position|role|opportunity)$/i.test(candidate)) {
          role = candidate;
          roleConfidence = 0.75;
          break;
        }
      }
    }

    // ─── Application ID (Indeed-specific) ───
    let applicationId: string | undefined;
    const appIdMatch = body.match(/application\s+(?:id|number|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // ─── Job Posting ID ───
    let requisitionId: string | undefined;
    const jobIdMatch = body.match(/job\s+(?:id|#|number)[\s:]*([A-Za-z0-9-]+)/i);
    if (jobIdMatch?.[1]) {
      requisitionId = jobIdMatch[1];
    }

    // ─── Location ───
    let location: string | undefined;
    let locationConfidence = 0;
    const locationMatch = body.match(/(?:location|based in|remote|position in)\s*:?\s*([^,\n]{3,50})/i);
    if (locationMatch?.[1]) {
      location = locationMatch[1].trim();
      locationConfidence = 0.7;
    }

    // ─── Salary (New) ───
    const salaryExtraction = extractSalary(body);

    // ─── Interview Details (Enhanced) ───
    const dateExtraction = eventType === "interview" 
      ? extractDateTime(body, { sentDate: new Date() })
      : { confidence: 0 };
    
    const links = extractInterviewLinks(body);
    const primaryLink = selectPrimaryInterviewLink(links);

    // ─── Deadline ───
    const deadlineExtraction = extractDeadline(body);

    // ─── Job URL ───
    let jobUrl: string | undefined;
    const jobUrlMatch = body.match(/https?:\/\/[^\s<>]*indeed\.com[^\s<>]*job[^\s<>]*/i);
    if (jobUrlMatch) {
      jobUrl = jobUrlMatch[0];
    }

    // ─── Work Mode Detection ───
    let workMode: "remote" | "hybrid" | "onsite" | undefined;
    if (/remote|work from home|work from anywhere|fully remote/i.test(body)) {
      workMode = "remote";
    } else if (/hybrid|mix of remote/i.test(body)) {
      workMode = "hybrid";
    } else if (/onsite|in office|on site|office location/i.test(body)) {
      workMode = "onsite";
    }

    // Calculate overall parser confidence
    const fieldsFound = [company, role, location, applicationId, salaryExtraction.maxSalary].filter(Boolean).length;
    const baseConfidence = 0.7;
    const parserConfidence = Math.min(0.95, baseConfidence + fieldsFound * 0.05);

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
        applicationId,
        requisitionId,
      },
      jobUrl,
      parserConfidence,
    };
  }
}

export const indeedParser = new IndeedParser();
