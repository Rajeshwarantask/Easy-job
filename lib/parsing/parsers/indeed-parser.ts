/**
 * Indeed Platform Parser
 * 
 * Extracts structured data from Indeed recruitment emails.
 * Handles: application confirmation, next steps, interview scheduling, offers.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

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
    const lowerBody = body.toLowerCase();

    // Determine event type
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|thank.*for.*applying/i.test(body)) {
      eventType = "applied";
      eventConfidence = 0.8;
    } else if (/interview.*scheduled|next.*step|invited.*to.*interview/i.test(body)) {
      eventType = "interview";
      eventConfidence = 0.8;
    } else if (/offer|congratulation|you.*selected/i.test(body)) {
      eventType = "offer";
      eventConfidence = 0.8;
    } else if (/unfortunately|regret|not.*moving|rejected/i.test(body)) {
      eventType = "rejection";
      eventConfidence = 0.8;
    } else if (/assessment|test|screening|coding challenge/i.test(body)) {
      eventType = "assessment";
      eventConfidence = 0.7;
    }

    // Extract company name from Indeed
    let company: string | undefined;
    let companyConfidence = 0.6;

    // Indeed usually includes company in subject or early body
    const companyMatch = body.match(/(?:for|at|position at|company:?\s*)\(?([A-Z][A-Za-z&\s]+?)\)?[\n,]/);
    if (companyMatch?.[1]) {
      company = companyMatch[1].trim();
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0.5;

    const roleMatch = body.match(/(?:job:|position:|role:|title:)\s*([^,\n]+)/i);
    if (roleMatch?.[1]) {
      role = roleMatch[1].trim();
    }

    // Extract application ID (Indeed uses "Application ID")
    let applicationId: string | undefined;
    const appIdMatch = body.match(/application\s+(?:id|number|#)[\s:]*([A-Za-z0-9-]+)/i);
    if (appIdMatch?.[1]) {
      applicationId = appIdMatch[1];
    }

    // Extract interview date
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;
    const dateMatch = body.match(/(?:interview|call|meeting)\s+(?:on|at|scheduled\s+for)\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
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
    const timeMatch = body.match(/(?:time|at)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|EST|PST)?)/i);
    if (timeMatch?.[1]) {
      interviewTime = timeMatch[1];
      interviewTimeConfidence = 0.7;
    }

    // Extract interview link
    let interviewLink: string | undefined;
    const linkMatch = body.match(/(?:join|meeting|call|video)[\s:]*?(https?:\/\/[^\s<>]+)/i);
    if (linkMatch?.[1]) {
      interviewLink = linkMatch[1];
    }

    // Extract job URL (Indeed usually includes this)
    let jobUrl: string | undefined;
    const jobUrlMatch = body.match(/https?:\/\/[^\s<>]*indeed\.com[^\s<>]*job[^\s<>]*/i);
    if (jobUrlMatch) {
      jobUrl = jobUrlMatch[0];
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
      },
      atsFields: {
        applicationId,
      },
      jobUrl,
      parserConfidence: 0.7,
    };
  }
}

export const indeedParser = new IndeedParser();
