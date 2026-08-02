/**
 * Workday Platform Parser
 * 
 * Extracts structured data from Workday recruitment emails.
 * Handles: application updates, interview scheduling, offers, and status changes.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";

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
    const lowerBody = body.toLowerCase();

    // Determine event type
    let eventType = "update";
    let eventConfidence = 0.4;

    if (/application.*received|received.*application|application.*submitted/i.test(body)) {
      eventType = "applied";
      eventConfidence = 0.8;
    } else if (/interview.*scheduled|interview.*invitation|interview.*date|interview time/i.test(body)) {
      eventType = "interview";
      eventConfidence = 0.85;
    } else if (/offer|congratulation|offer.*letter|you.{0,10}selected/i.test(body)) {
      eventType = "offer";
      eventConfidence = 0.85;
    } else if (/unfortunately|regret|not.*selected|rejected|application.*closed/i.test(body)) {
      eventType = "rejection";
      eventConfidence = 0.8;
    } else if (/assessment|test|screening|questionnaire/i.test(body)) {
      eventType = "assessment";
      eventConfidence = 0.75;
    }

    // Extract company name
    let company: string | undefined;
    let companyConfidence = 0.65;

    // Workday emails usually contain: "Job Application for [Company]"
    const companyMatch = body.match(/(?:job\s+)?application\s+(?:for|at|with)\s+([A-Z][A-Za-z&\s]+?)(?:\n|,|$)/i);
    if (companyMatch?.[1]) {
      company = companyMatch[1].trim();
    }

    // Extract role
    let role: string | undefined;
    let roleConfidence = 0.5;

    const roleMatch = body.match(/(?:position|job|role)\s*:?\s*([^,\n]+)/i);
    if (roleMatch?.[1]) {
      role = roleMatch[1].trim();
    }

    // Extract requisition ID (Workday uses this)
    let requisitionId: string | undefined;
    const reqIdMatch = body.match(/requisition\s+(?:id|#|number)[\s:]*([A-Za-z0-9-]+)/i);
    if (reqIdMatch?.[1]) {
      requisitionId = reqIdMatch[1];
    }

    // Extract interview date
    let interviewDate: Date | undefined;
    let interviewDateConfidence = 0;

    const dateMatch = body.match(/(?:interview|call|meeting)(?:\s+scheduled\s+for|\s+on|\s+at)\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
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

    // Extract interview details (Workday often includes structured info)
    let interviewLink: string | undefined;
    const linkMatch = body.match(/(?:join|link|url|call)[\s:]*?(https?:\/\/[^\s<>]+)/i);
    if (linkMatch?.[1]) {
      interviewLink = linkMatch[1];
    }

    // Extract salary for offer emails
    let salary: string | undefined;
    const salaryMatch = body.match(/(?:salary|compensation|offer)[\s:]*(?:\$|USD)?([0-9,]+(?:\.[0-9]{2})?)\s*(?:per|\/|year|annually)/i);
    if (salaryMatch?.[1]) {
      salary = salaryMatch[1];
    }

    // Extract offer deadline
    let offerDeadline: Date | undefined;
    let offerDeadlineConfidence = 0;

    const deadlineMatch = body.match(/(?:offer.*deadline|respond\s+by|must.*accept|decision\s+by)\s+([A-Za-z]+\s+\d{1,2})/i);
    if (deadlineMatch?.[1]) {
      try {
        offerDeadline = new Date(deadlineMatch[1]);
        if (!isNaN(offerDeadline.getTime())) {
          offerDeadlineConfidence = 0.7;
        }
      } catch {
        // Skip
      }
    }

    // Extract career portal URL
    let careerPortalUrl: string | undefined;
    const portalMatch = body.match(/https?:\/\/[^\s<>]*workday\.com[^\s<>]*/i);
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
        ...(interviewLink && {
          interviewLink: { value: interviewLink, confidence: 0.75 },
        }),
        ...(salary && {
          salary: { value: salary, confidence: 0.7 },
        }),
        ...(offerDeadline && {
          offerDeadline: { value: offerDeadline, confidence: offerDeadlineConfidence },
        }),
      },
      atsFields: {
        requisitionId,
      },
      careerPortalUrl,
      parserConfidence: 0.75,
    };
  }
}

export const workdayParser = new WorkdayParser();
