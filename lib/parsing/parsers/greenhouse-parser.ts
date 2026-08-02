/**
 * Greenhouse Platform Parser (Enhanced)
 * 
 * Extracts structured data from Greenhouse recruitment emails.
 * Handles: application confirmation, interviews, offers, and next steps.
 * 
 * Phase 2 Enhancements:
 * - Candidate ID and profile URL extraction
 * - Job ID in application URLs
 * - Interview link platform detection
 * - Salary extraction from offer emails
 * - Advanced date/time parsing with timezone
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
} from "../field-extractors/interview-link-extractor";
import { extractSalary } from "../field-extractors/salary-extractor";

export class GreenhouseParser implements PlatformParser {
  platformId = "greenhouse";
  platformName = "Greenhouse";

  canHandle(from: string, subject: string): boolean {
    return /greenhouse/.test(from) || /greenhouse/i.test(subject);
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

    if (/application.*received|received.*application|thank.*for.*applying|application submitted/i.test(fullText)) {
      eventType = "applied";
      eventConfidence = 0.9;
    } else if (/interview.*scheduled|next.*stage|next.*round|interview date|interview time|interview confirmed/i.test(fullText)) {
      eventType = "interview";
      eventConfidence = 0.9;
    } else if (/offer|congratulation|we.{0,10}excited|you.*selected|move.*forward|job offer|offer letter/i.test(fullText)) {
      eventType = "offer";
      eventConfidence = 0.92;
    } else if (/unfortunately|regret|not.*moving|decline|rejection|not moving forward/i.test(fullText)) {
      eventType = "rejection";
      eventConfidence = 0.9;
    } else if (/assessment|take.*test|screening|coding.*challenge|complete.*assessment/i.test(fullText)) {
      eventType = "assessment";
      eventConfidence = 0.85;
    }

    // ─── Company Name (Enhanced) ───
    let company: string | undefined;
    let companyConfidence = 0.7;

    // Greenhouse patterns
    const companyPatterns = [
      /([A-Z][A-Za-z&\s]+?)\s+(?:is\s+)?(?:excited|interviewing|has|would|thanks)\b/,
      /(?:at|from)\s+([A-Z][A-Za-z&\s]{3,40})(?:\s+(?:is|has|would))/i,
    ];

    for (const pattern of companyPatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        company = match[1].trim();
        companyConfidence = 0.8;
        break;
      }
    }

    // ─── Role (Enhanced) ───
    let role: string | undefined;
    let roleConfidence = 0.6;

    const rolePatterns = [
      /(?:position|job|role)\s+(?:of|for|:)\s+(?:"|')?([^"',\n]{5,50})/i,
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

    // ─── Greenhouse-Specific IDs (Enhanced) ───
    let requisitionId: string | undefined;
    let applicationId: string | undefined;
    let candidateId: string | undefined;

    // Greenhouse typically uses these patterns
    const reqIdMatch = body.match(/requisition\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (reqIdMatch?.[1]) {
      requisitionId = reqIdMatch[1];
    }

    const appIdMatch = body.match(/application\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // Extract candidate ID (Greenhouse assigns one to each applicant)
    const candidateMatch = body.match(/candidate\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (candidateMatch?.[1]) {
      candidateId = candidateMatch[1];
    }

    // Try to extract from Greenhouse URLs: /candidates/[candidateId]
    if (!candidateId) {
      const urlCandidateMatch = body.match(/\/candidates\/(\d+)/i);
      if (urlCandidateMatch?.[1]) {
        candidateId = urlCandidateMatch[1];
      }
    }

    // Extract job ID from URL if present
    if (!requisitionId) {
      const urlJobMatch = body.match(/\/jobs\/(\d+)/i);
      if (urlJobMatch?.[1]) {
        requisitionId = urlJobMatch[1];
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

    // ─── Interview Details (Enhanced with new extractors) ───
    const dateExtraction = eventType === "interview"
      ? extractDateTime(body, { sentDate: new Date() })
      : { confidence: 0 };

    const links = extractInterviewLinks(body);
    const primaryLink = selectPrimaryInterviewLink(links);

    // ─── Interviewer Information ───
    let interviewerName: string | undefined;
    let interviewerEmail: string | undefined;

    // Try "Interview with [Name]" or "Your interviewer: [Name]"
    const interviewerMatch = body.match(/(?:interview.*with|interviewer|speaking with|from)\s+([A-Za-z\s]+?)(?:\s+(?:at|from|of|\()|,|\.|\n)/i);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    // Extract email from "from:" or if in signature
    const emailInSig = body.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailInSig?.[1] && !emailInSig[1].includes("noreply")) {
      interviewerEmail = emailInSig[1];
    }

    // ─── Salary (New - for offer emails) ───
    const salaryExtraction = eventType === "offer" ? extractSalary(body) : { confidence: 0 };

    // ─── Deadline (New) ───
    const deadlineExtraction = extractDeadline(body);

    // ─── URLs ───
    let jobUrl: string | undefined;
    let careerPortalUrl: string | undefined;
    let candidateProfileUrl: string | undefined;

    const urlMatches = body.match(/https?:\/\/[^\s<>]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        if (/job|position|role/.test(url)) {
          jobUrl = url;
        } else if (/candidates\/\d+/.test(url)) {
          candidateProfileUrl = url;
        } else if (/greenhouse|application|portal/.test(url) && !careerPortalUrl) {
          careerPortalUrl = url;
        }
      }
    }

    // ─── Work Mode ───
    let workMode: "remote" | "hybrid" | "onsite" | undefined;
    if (/remote|work from home|fully remote/i.test(body)) {
      workMode = "remote";
    } else if (/hybrid|mix of remote/i.test(body)) {
      workMode = "hybrid";
    } else if (/onsite|office|in-person/i.test(body)) {
      workMode = "onsite";
    }

    // Calculate overall confidence
    const fieldsFound = [company, role, location, requisitionId, candidateId].filter(Boolean).length;
    const baseConfidence = 0.8;
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
          interviewerName: { value: interviewerName, confidence: 0.75 },
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
        requisitionId,
        candidateId,
      },
      jobUrl,
      careerPortalUrl,
      candidateProfileUrl,
      parserConfidence,
    };
  }
}

export const greenhouseParser = new GreenhouseParser();
