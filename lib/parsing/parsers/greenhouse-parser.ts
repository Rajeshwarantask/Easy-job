/**
 * Greenhouse Platform Parser
 * 
 * Extracts structured data from Greenhouse recruitment emails.
 * Handles: application confirmation, interviews, offers, and next steps.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

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
    const lowerBody = body.toLowerCase();

    // Determine event type
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|thank.*for.*applying/i.test(body)) {
      eventType = "applied";
      eventConfidence = 0.85;
    } else if (/interview.*scheduled|next.*stage|next.*round|interview date|interview time/i.test(body)) {
      eventType = "interview";
      eventConfidence = 0.85;
    } else if (/offer|congratulation|we.{0,10}excited|you.*selected|move.*forward/i.test(body)) {
      eventType = "offer";
      eventConfidence = 0.85;
    } else if (/unfortunately|regret|not.*moving|decline|rejection/i.test(body)) {
      eventType = "rejection";
      eventConfidence = 0.85;
    } else if (/assessment|take.*test|screening|coding.*challenge/i.test(body)) {
      eventType = "assessment";
      eventConfidence = 0.8;
    }

    // Extract company name (Greenhouse emails often include this prominently)
    let company: string | undefined;
    let companyConfidence = 0.7;

    // Try: "Company Name is excited" or "We're excited to hear from you at Company"
    const companyMatch = body.match(/([A-Z][A-Za-z&\s]+?)\s+(?:is\s+)?(?:excited|interviewing|has|would|has)/);
    if (companyMatch?.[1]) {
      company = companyMatch[1].trim();
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0.6;

    const roleMatch = body.match(/(?:position|job|role)\s+(?:of|for|:)\s+(?:"|')?([^"',\n]+)/i);
    if (roleMatch?.[1]) {
      role = roleMatch[1].trim();
    }

    // Extract requisition ID or application ID
    let requisitionId: string | undefined;
    let applicationId: string | undefined;

    const reqIdMatch = body.match(/requisition\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (reqIdMatch?.[1]) {
      requisitionId = reqIdMatch[1];
    }

    const appIdMatch = body.match(/application\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // Extract interview date
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;

    const datePatterns = [
      /interview.*(?:on|at|scheduled|date)[\s:]*([A-Za-z]+\s+\d{1,2})/i,
      /(?:on|at)\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        try {
          interviewDate = new Date(match[1]);
          if (!isNaN(interviewDate.getTime())) {
            interviewDateConfidence = 0.75;
            break;
          }
        } catch {
          // Skip
        }
      }
    }

    // Extract interview time
    let interviewTime: string | undefined;
    let interviewTimeConfidence = 0;

    const timeMatch = body.match(/(?:time|at)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
    if (timeMatch?.[1]) {
      interviewTime = timeMatch[1];
      interviewTimeConfidence = 0.75;
    }

    // Extract interview link (often embedded as "Join link" or similar)
    let interviewLink: string | undefined;
    const linkMatches = body.match(/https?:\/\/[^\s<>]+(?:zoom|meet|teams|webex|call)[^\s<>]*/gi);
    if (linkMatches) {
      interviewLink = linkMatches[0];
    } else {
      // Fall back to any link starting with https
      const anyLink = body.match(/https?:\/\/[^\s<>]+/);
      if (anyLink) {
        interviewLink = anyLink[0];
      }
    }

    // Extract interviewer name
    let interviewerName: string | undefined;
    const interviewerMatch = body.match(/interviewer[\s:]*([A-Za-z\s]+?)(?:\n|,|$)/i);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    // Extract job URL or application URL
    let jobUrl: string | undefined;
    let careerPortalUrl: string | undefined;

    const urlMatches = body.match(/https?:\/\/[^\s<>]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        if (/job|position|role/.test(url)) {
          jobUrl = url;
        } else if (/greenhouse|application|portal/.test(url) && !careerPortalUrl) {
          careerPortalUrl = url;
        }
      }
    }

    return {
      company: company ? { value: company, confidence: companyConfidence } : undefined,
      role: role ? { value: role, confidence: roleConfidence } : undefined,
      eventType: { value: eventType as any, confidence: eventConfidence },
      eventDetails: {
        ...(interviewDate && {
          interviewDate: { value: interviewDate, confidence: interviewDateConfidence },
        }),
        ...(interviewTime && {
          interviewTime: { value: interviewTime, confidence: interviewTimeConfidence },
        }),
        ...(interviewLink && {
          interviewLink: { value: interviewLink, confidence: 0.8 },
        }),
        ...(interviewerName && {
          interviewerName: { value: interviewerName, confidence: 0.7 },
        }),
      },
      atsFields: {
        applicationId,
        requisitionId,
      },
      jobUrl,
      careerPortalUrl,
      parserConfidence: 0.8,
    };
  }
}

export const greenhouseParser = new GreenhouseParser();
