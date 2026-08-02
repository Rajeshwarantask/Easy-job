/**
 * Lever Platform Parser
 * 
 * Extracts structured data from Lever recruitment emails.
 * Handles: application confirmation, next steps, interviews, offers.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

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
    const lowerBody = body.toLowerCase();

    // Determine event type
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|thank.*for.*applying/i.test(body)) {
      eventType = "applied";
      eventConfidence = 0.8;
    } else if (/interview|interview.*scheduled|next.*step|call/i.test(body)) {
      eventType = "interview";
      eventConfidence = 0.8;
    } else if (/offer|congratulation|we.{0,10}offer|move.*forward/i.test(body)) {
      eventType = "offer";
      eventConfidence = 0.8;
    } else if (/unfortunately|regret|not.*selected|rejected/i.test(body)) {
      eventType = "rejection";
      eventConfidence = 0.8;
    } else if (/screening|assessment|test|questionnaire/i.test(body)) {
      eventType = "assessment";
      eventConfidence = 0.75;
    }

    // Extract company name
    let company: string | undefined;
    let companyConfidence = 0.65;

    // Lever emails often have: "Application for [role] at [company]"
    const companyMatch = body.match(/(?:at|join)\s+([A-Z][A-Za-z&\s]+?)(?:\n|,|$)/);
    if (companyMatch?.[1]) {
      company = companyMatch[1].trim();
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0.55;

    const roleMatch = body.match(/(?:application\s+for|position|role)\s+(?:the\s+)?(?:"|')?([^"',\n]+?)(?:"|')?(?:\s+at|\s+position|\s+role|,|$)/i);
    if (roleMatch?.[1]) {
      role = roleMatch[1].trim();
    }

    // Extract application ID (Lever sometimes includes this)
    let applicationId: string | undefined;
    const appIdMatch = body.match(/application\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // Extract interview date
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;

    const dateMatch = body.match(/(?:interview|call|meeting|schedule)\s+(?:on|for|at|date)[\s:]*([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
    if (dateMatch?.[1]) {
      try {
        interviewDate = new Date(dateMatch[1]);
        if (!isNaN(interviewDate.getTime())) {
          interviewDateConfidence = 0.7;
        }
      } catch {
        // Skip
      }
    }

    // Extract interview time
    let interviewTime: string | undefined;
    let interviewTimeConfidence = 0;

    const timeMatch = body.match(/(?:time|at)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
    if (timeMatch?.[1]) {
      interviewTime = timeMatch[1];
      interviewTimeConfidence = 0.7;
    }

    // Extract interviewer name
    let interviewerName: string | undefined;
    const interviewerMatch = body.match(/(?:with|interviewer|speak\s+with)\s+([A-Za-z\s]+?)(?:\n|,|\(|$)/);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    // Extract interview link
    let interviewLink: string | undefined;
    const linkMatch = body.match(/(?:join|meeting|call|link)[\s:]*?(https?:\/\/[^\s<>]+)/i);
    if (linkMatch?.[1]) {
      interviewLink = linkMatch[1];
    }

    // Extract job URL (Lever jobs.lever.co)
    let jobUrl: string | undefined;
    const jobUrlMatch = body.match(/https?:\/\/[^\s<>]*jobs\.lever\.co[^\s<>]*/i);
    if (jobUrlMatch) {
      jobUrl = jobUrlMatch[0];
    }

    // Extract application/candidate portal URL
    let careerPortalUrl: string | undefined;
    const portalMatch = body.match(/https?:\/\/[^\s<>]*lever\.co[^\s<>]*(?:candidate|application|profile)[^\s<>]*/i);
    if (portalMatch) {
      careerPortalUrl = portalMatch[0];
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
        ...(interviewerName && {
          interviewerName: { value: interviewerName, confidence: 0.65 },
        }),
        ...(interviewLink && {
          interviewLink: { value: interviewLink, confidence: 0.8 },
        }),
      },
      atsFields: {
        applicationId,
      },
      jobUrl,
      careerPortalUrl,
      parserConfidence: 0.75,
    };
  }
}

export const leverParser = new LeverParser();
