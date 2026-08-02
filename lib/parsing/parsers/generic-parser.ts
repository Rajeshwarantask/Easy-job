/**
 * Generic Recruitment Email Parser
 * 
 * Fallback parser for emails that don't match specific ATS platforms.
 * Uses regex patterns to extract common recruitment email structures.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

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

    // Determine event type from subject/body keywords
    let eventType = "update";
    let eventConfidence = 0.3;

    if (/(?:congratulations|offer|job offer|we.{0,10}pleased|you.{0,10}selected)/i.test(fullText)) {
      eventType = "offer";
      eventConfidence = 0.7;
    } else if (/(?:interview|interview scheduled|interview time|interview date|call.*scheduled)/i.test(fullText)) {
      eventType = "interview";
      eventConfidence = 0.7;
    } else if (/(?:assessment|coding.*challenge|take.*test|questionnaire|screening|technical.*test)/i.test(fullText)) {
      eventType = "assessment";
      eventConfidence = 0.7;
    } else if (/(?:unfortunately|regret|not.*moving|not.*selected|rejected|rejection)/i.test(fullText)) {
      eventType = "rejection";
      eventConfidence = 0.7;
    } else if (/(?:received.*application|application.*received|thank.*applied|we.{0,10}received)/i.test(fullText)) {
      eventType = "applied";
      eventConfidence = 0.6;
    }

    // Extract company name
    let company: string | undefined;
    let companyConfidence = 0;

    // Try: "at Company Name" or "Company Name is hiring"
    const atCompanyMatch = fullText.match(/(?:at|joining|applying to|applied at)\s+([A-Z][A-Za-z&\s]+?)(?:\s+for|\s+as|\s+to|\s+is|\.|,|$)/);
    if (atCompanyMatch?.[1]) {
      company = atCompanyMatch[1].trim();
      companyConfidence = 0.6;
    }

    // Try email domain
    if (!company) {
      const domainMatch = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
      if (domainMatch?.[1]) {
        const domain = domainMatch[1];
        // Skip known ATS domains
        if (!/workday|greenhouse|lever|ashby|indeed/i.test(domain)) {
          company = domain.split(".")[0];
          companyConfidence = 0.4;
        }
      }
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0;

    // Try: "for [role]" or "position: [role]" or "[role] position"
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
          roleConfidence = 0.6;
          break;
        }
      }
    }

    // Extract location
    let location: string | undefined;
    let locationConfidence = 0;

    const locationPatterns = [
      /(?:location|based in|located in|position in|role in|remote)[\s:]*([^,.:\n]{5,50})/i,
      /(?:in|at)[\s:]+((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*,?\s*)*[A-Z]{2})/i,
    ];

    for (const pattern of locationPatterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) {
        location = match[1].trim();
        locationConfidence = 0.5;
        break;
      }
    }

    // Extract interview date/time
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;
    let interviewTime: string | undefined;
    let interviewTimeConfidence = 0;

    // Match dates like "January 15" or "15/01/2024" or "Jan 15"
    const datePatterns = [
      /(?:interview|call|meeting)\s+on\s+([A-Za-z]+\s+\d{1,2}(?:\s*,?\s*\d{4})?)/i,
      /(?:scheduled\s+for|date:)\s+([A-Za-z]+\s+\d{1,2})/i,
    ];

    for (const pattern of datePatterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) {
        try {
          interviewDate = new Date(match[1]);
          if (!isNaN(interviewDate.getTime())) {
            interviewDateConfidence = 0.6;
            break;
          }
        } catch {
          // Skip invalid dates
        }
      }
    }

    // Match times like "10:00 AM" or "14:30"
    const timeMatch = fullText.match(/(?:time|at|scheduled\s+at)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
    if (timeMatch?.[1]) {
      interviewTime = timeMatch[1];
      interviewTimeConfidence = 0.6;
    }

    // Extract links
    let jobUrl: string | undefined;
    let careerPortalUrl: string | undefined;

    // Look for common link patterns in the body
    const linkPatterns = [
      /(?:view.*job|job.*link|apply.*now)[\s:]*https?:\/\/[^\s<>]+/i,
      /https?:\/\/[^\s<>]*(?:job|apply|careers|position)[^\s<>]*/i,
      /https?:\/\/[^\s<>]+/,
    ];

    const allLinks = body.match(/https?:\/\/[^\s<>]+/gi) || [];
    if (allLinks.length > 0) {
      jobUrl = allLinks[0];
      if (allLinks.length > 1) {
        careerPortalUrl = allLinks[1];
      }
    }

    // Overall confidence
    const fieldsFound = [company, role, location].filter(Boolean).length;
    const parserConfidence = Math.min(0.6, 0.2 + fieldsFound * 0.15);

    return {
      company: company ? { value: company, confidence: companyConfidence } : undefined,
      role: role ? { value: role, confidence: roleConfidence } : undefined,
      location: location ? { value: location, confidence: locationConfidence } : undefined,
      eventType: { value: eventType as any, confidence: eventConfidence },
      eventDetails: {
        ...(interviewDate && {
          interviewDate: { value: interviewDate, confidence: interviewDateConfidence },
        }),
        ...(interviewTime && {
          interviewTime: { value: interviewTime, confidence: interviewTimeConfidence },
        }),
      },
      atsFields: {},
      jobUrl,
      careerPortalUrl,
      parserConfidence,
      rawPatternMatches: {
        eventType,
        company: company || null,
        role: role || null,
        location: location || null,
      },
    };
  }
}

export const genericParser = new GenericParser();
