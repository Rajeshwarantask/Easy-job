/**
 * Lever Platform Parser (Enhanced)
 * 
 * Extracts structured data from Lever recruitment emails.
 * Handles: application confirmation, next steps, interviews, offers.
 * 
 * Phase 2 Enhancements:
 * - Candidate ID extraction
 * - Interview link platform detection
 * - Advanced date/time parsing
 * - Salary extraction from offers
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

export class LeverParser implements PlatformParser {
  platformId = "lever";
  platformName = "Lever";

  canHandle(from: string, subject: string): boolean {
    return /lever/.test(from) || /lever/i.test(subject);
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

    if (/application.*received|received.*application|thank.*for.*applying|application submitted/i.test(fullText)) {
      eventType = "applied";
      eventConfidence = 0.85;
    } else if (/interview|interview.*scheduled|next.*step|call|interview invitation/i.test(fullText)) {
      eventType = "interview";
      eventConfidence = 0.85;
    } else if (/offer|congratulation|we.{0,10}offer|move.*forward|job offer|extended.*offer/i.test(fullText)) {
      eventType = "offer";
      eventConfidence = 0.85;
    } else if (/unfortunately|regret|not.*selected|rejected|not moving forward/i.test(fullText)) {
      eventType = "rejection";
      eventConfidence = 0.85;
    } else if (/screening|assessment|test|questionnaire|complete.*test/i.test(fullText)) {
      eventType = "assessment";
      eventConfidence = 0.8;
    }

    // ─── Company (Enhanced) ───
    let company: string | undefined;
    let companyConfidence = 0.65;

    const companyPatterns = [
      /(?:at|join|from|for)\s+([A-Z][A-Za-z&\s]{3,40})(?:\n|,|$)/,
      /Application for\s+\w+\s+at\s+([A-Z][A-Za-z&\s]+)/i,
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
      /(?:application\s+for|position|role)\s+(?:the\s+)?(?:"|')?([^"',\n]{5,50})/i,
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
    const locationMatch = body.match(/(?:location|based in|position in)\s*:?\s*([^,\n]{3,50})/i);
    if (locationMatch?.[1]) {
      location = locationMatch[1].trim();
      locationConfidence = 0.7;
    }

    // ─── Work Mode ───
    let workMode: "remote" | "hybrid" | "onsite" | undefined;
    if (/remote|work from home|fully remote|work anywhere/i.test(body)) {
      workMode = "remote";
    } else if (/hybrid|mix of remote/i.test(body)) {
      workMode = "hybrid";
    } else if (/onsite|office|in-person/i.test(body)) {
      workMode = "onsite";
    }

    // ─── Lever-Specific IDs (Enhanced) ───
    let applicationId: string | undefined;
    let candidateId: string | undefined;
    let requisitionId: string | undefined;

    const appIdMatch = body.match(/application\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    const candidateMatch = body.match(/candidate\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (candidateMatch?.[1]) {
      candidateId = candidateMatch[1];
    }

    // Extract from Lever URLs: /candidates/[id]
    if (!candidateId) {
      const urlCandidateMatch = body.match(/\/candidates\/([A-Za-z0-9-]+)/i);
      if (urlCandidateMatch?.[1]) {
        candidateId = urlCandidateMatch[1];
      }
    }

    // Try to extract job ID
    if (!requisitionId) {
      const urlJobMatch = body.match(/\/postings\/([A-Za-z0-9-]+)/i);
      if (urlJobMatch?.[1]) {
        requisitionId = urlJobMatch[1];
      }
    }

    // ─── Interview Details (Enhanced) ───
    const dateExtraction = eventType === "interview"
      ? extractDateTime(body, { sentDate: new Date() })
      : { confidence: 0 };

    const links = extractInterviewLinks(body);
    const primaryLink = selectPrimaryInterviewLink(links);

    // ─── Interviewer Information ───
    let interviewerName: string | undefined;
    let interviewerEmail: string | undefined;

    const interviewerMatch = body.match(/(?:with|interviewer|speak\s+with|from)\s+([A-Za-z\s]+?)(?:\n|,|\(|$)/);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    const emailMatch = body.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch?.[1] && !emailMatch[1].includes("noreply")) {
      interviewerEmail = emailMatch[1];
    }

    // ─── Salary (New) ───
    const salaryExtraction = eventType === "offer" ? extractSalary(body) : { confidence: 0 };

    // ─── Deadline (New) ───
    const deadlineExtraction = eventType === "offer" ? extractDeadline(body) : { confidence: 0 };

    // ─── URLs ───
    let jobUrl: string | undefined;
    let careerPortalUrl: string | undefined;

    const jobUrlMatch = body.match(/https?:\/\/[^\s<>]*jobs\.lever\.co[^\s<>]*/i);
    if (jobUrlMatch) {
      jobUrl = jobUrlMatch[0];
    }

    const portalMatch = body.match(/https?:\/\/[^\s<>]*lever\.co[^\s<>]*(?:candidate|application|profile)[^\s<>]*/i);
    if (portalMatch) {
      careerPortalUrl = portalMatch[0];
    }

    // Calculate overall confidence
    const fieldsFound = [company, role, location, applicationId, candidateId].filter(Boolean).length;
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
        ...(interviewerName && {
          interviewerName: { value: interviewerName, confidence: 0.7 },
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
      atsFields: {
        applicationId,
        candidateId,
        requisitionId,
      },
      jobUrl,
      careerPortalUrl,
      parserConfidence,
    };
  }
}

export const leverParser = new LeverParser();
