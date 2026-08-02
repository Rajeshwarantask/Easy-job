/**
 * Ashby Platform Parser
 * 
 * Extracts structured data from Ashby recruitment emails.
 * Handles: application confirmation, interview scheduling, offers, and status updates.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

export class AshbyParser implements PlatformParser {
  platformId = "ashby";
  platformName = "Ashby";

  canHandle(from: string, subject: string): boolean {
    return /ashby/.test(from) || /ashby/i.test(subject);
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

    if (/application.*received|received.*application|application.*submitted/i.test(body)) {
      eventType = "applied";
      eventConfidence = 0.8;
    } else if (/interview.*scheduled|interview.*invitation|interview|next.*stage/i.test(body)) {
      eventType = "interview";
      eventConfidence = 0.8;
    } else if (/offer|congratulation|we.{0,10}excited|move.*forward|advance/i.test(body)) {
      eventType = "offer";
      eventConfidence = 0.8;
    } else if (/unfortunately|regret|not.*moving|not.*selected|rejected/i.test(body)) {
      eventType = "rejection";
      eventConfidence = 0.8;
    } else if (/assessment|screening|test|evaluation|coding/i.test(body)) {
      eventType = "assessment";
      eventConfidence = 0.75;
    }

    // Extract company name
    let company: string | undefined;
    let companyConfidence = 0.65;

    // Ashby emails usually have: "Application for [role] at [company]"
    const companyMatch = body.match(/(?:at|for\s+[A-Za-z\s]+\s+at)\s+([A-Z][A-Za-z&\s]+?)(?:\n|,|!|$)/);
    if (companyMatch?.[1]) {
      company = companyMatch[1].trim();
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0.55;

    const roleMatch = body.match(/(?:for|application\s+for|position)\s+(?:the\s+)?(?:"|')?([^"',\n]+?)(?:"|')?(?:\s+role|\s+position|,|\s+at|$)/i);
    if (roleMatch?.[1]) {
      role = roleMatch[1].trim();
    }

    // Extract candidate ID or application ID (Ashby uses these)
    let candidateId: string | undefined;
    let applicationId: string | undefined;

    const candIdMatch = body.match(/candidate\s+(?:id|#|identifier)[\s:]*([A-Za-z0-9-]+)/i);
    if (candIdMatch?.[1]) {
      candidateId = candIdMatch[1];
    }

    const appIdMatch = body.match(/application\s+(?:id|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // Extract interview date
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;

    const dateMatch = body.match(/(?:interview|call|meeting|scheduled)\s+(?:on|for|at)\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
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

    // Extract interviewer information
    let interviewerName: string | undefined;
    const interviewerMatch = body.match(/(?:with|interviewer|speak\s+with|meet\s+with)\s+([A-Za-z\s]+?)(?:\n|,|\(|$)/);
    if (interviewerMatch?.[1]) {
      interviewerName = interviewerMatch[1].trim();
    }

    // Extract interview link
    let interviewLink: string | undefined;
    const linkMatch = body.match(/(?:join|meeting|video|call|link)[\s:]*?(https?:\/\/[^\s<>]+)/i);
    if (linkMatch?.[1]) {
      interviewLink = linkMatch[1];
    }

    // Extract job URL (Ashby uses apply.ashby.com)
    let jobUrl: string | undefined;
    const jobUrlMatch = body.match(/https?:\/\/[^\s<>]*apply\.ashby\.com[^\s<>]*/i);
    if (jobUrlMatch) {
      jobUrl = jobUrlMatch[0];
    }

    // Extract candidate portal URL
    let careerPortalUrl: string | undefined;
    const portalMatch = body.match(/https?:\/\/[^\s<>]*ashby\.com[^\s<>]*(?:candidate|application|portal)[^\s<>]*/i);
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
        candidateId,
      },
      jobUrl,
      careerPortalUrl,
      parserConfidence: 0.75,
    };
  }
}

export const ashbyParser = new AshbyParser();
