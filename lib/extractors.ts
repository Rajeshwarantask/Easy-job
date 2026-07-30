/**
 * Deterministic field extractors.
 *
 * These run on EVERY email (they are cheap and free) and pull out every
 * structured fact we can find without AI: recruitment platform, application /
 * requisition / candidate IDs, interview date-time / timezone / links,
 * assessment links, coding platforms, deadlines, work mode, location, salary,
 * recruiter identity and relevant URLs.
 *
 * AI is only consulted later for the genuinely ambiguous, unstructured fields.
 */

export const PLATFORMS: Record<string, string[]> = {
  LinkedIn: ["linkedin"],
  Indeed: ["indeed"],
  Greenhouse: ["greenhouse"],
  Lever: ["lever.co"], // removed bare "lever" to avoid matching "leverage" in regular emails
  Workday: ["workday", "myworkday"],
  Ashby: ["ashbyhq"], // removed bare "ashby" to avoid substring collisions
  BambooHR: ["bamboohr"],
  Glassdoor: ["glassdoor"],
  ZipRecruiter: ["ziprecruiter"],
  Wellfound: ["angel.co", "wellfound"],
  Dice: ["dice.com"],
  Monster: ["monster.com"],
  Naukri: ["naukri.com", "naukri"],
  Internshala: ["internshala"],
  Foundit: ["foundit", "monsterindia"],
  HirePro: ["hirepro"],
  iHire: ["ihire"],
  Jobvite: ["jobvite"],
  SmartRecruiters: ["smartrecruiters"],
  iCIMS: ["icims"],
  Taleo: ["taleo"],
  Unstop: ["unstop", "dare2compete"],
};

export const CODING_PLATFORMS: Record<string, RegExp> = {
  HackerRank: /hackerrank/i,
  HackerEarth: /hackerearth/i,
  Codility: /codility/i,
  LeetCode: /leetcode/i,
  CodeSignal: /codesignal/i,
  Codewars: /codewars/i,
  Coderbyte: /coderbyte/i,
  Karat: /karat/i,
  CoderPad: /coderpad/i,
  DoSelect: /doselect/i,
  Mettl: /mettl/i,
};

export interface ExtractedFields {
  platform: string | null;
  applicationId: string | null;
  requisitionId: string | null;
  candidateId: string | null;
  interviewDate: string | null; // ISO date (yyyy-mm-dd) when confidently parsed
  interviewTimeRaw: string | null; // raw time string as seen in the email
  timezone: string | null;
  interviewLink: string | null;
  assessmentLink: string | null;
  codingPlatform: string | null;
  deadline: string | null; // raw deadline text
  workMode: "remote" | "hybrid" | "onsite" | null;
  location: string | null;
  salaryRaw: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  jobUrl: string | null;
  careerPortalUrl: string | null;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]]+/gi;

/** Detect the ATS / job board a message came through. */
export function detectPlatform(from: string, body = ""): string | null {
  const haystack = `${from} ${body}`.toLowerCase();
  for (const [platform, keywords] of Object.entries(PLATFORMS)) {
    if (keywords.some((k) => haystack.includes(k))) return platform;
  }
  return null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function detectCodingPlatform(text: string): string | null {
  for (const [name, re] of Object.entries(CODING_PLATFORMS)) {
    if (re.test(text)) return name;
  }
  return null;
}

function classifyUrl(url: string): "interview" | "assessment" | "job" | "career" | "other" {
  const u = url.toLowerCase();
  if (/(zoom\.us|meet\.google|teams\.microsoft|teams\.live|webex|whereby|hangouts)/.test(u))
    return "interview";
  if (Object.values(CODING_PLATFORMS).some((re) => re.test(u))) return "assessment";
  if (/(assessment|test|challenge|evaluation|coding)/.test(u)) return "assessment";
  if (/(jobs?|careers?|apply|opening|requisition|posting|vacanc)/.test(u)) return "job";
  return "other";
}

function detectWorkMode(text: string): ExtractedFields["workMode"] {
  if (/\b(fully )?remote\b|work from home|wfh/i.test(text)) return "remote";
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(on.?site|in.?office|in.?person|onsite)\b/i.test(text)) return "onsite";
  return null;
}

/**
 * Extract every structured field we can from an email deterministically.
 * Never throws — a failed sub-extraction just yields null for that field.
 */
export function extractStructuredFields(
  from: string,
  subject: string,
  body: string,
): ExtractedFields {
  const text = `${subject}\n${body}`;

  const applicationId = firstMatch(text, [
    /application\s*(?:id|number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
    /app(?:lication)?\s*ref(?:erence)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
  ]);

  const requisitionId = firstMatch(text, [
    /requisition\s*(?:id|number|no\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i,
    // Fixed: make id-marker mandatory (not optional) to avoid matching "required" as "req + optional"
    /\brequisition\s*(?:id|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i,
    /\bjob\s*id\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i,
  ]);

  const candidateId = firstMatch(text, [
    /candidate\s*(?:id|number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
    /applicant\s*(?:id|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
  ]);

  // Interview date — accept "Jul 15, 2026", "15 July 2026", "2026-07-15", "15/07/2026"
  const interviewDateRaw = firstMatch(text, [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\b/i,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i,
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
  ]);
  let interviewDate: string | null = null;
  if (interviewDateRaw) {
    // Try ISO format first (yyyy-mm-dd)
    if (/^\d{4}-\d{2}-\d{2}$/.test(interviewDateRaw)) {
      interviewDate = interviewDateRaw;
    } else {
      // Try parsing as generic date (handles named months)
      const parsed = new Date(interviewDateRaw);
      if (!Number.isNaN(parsed.getTime())) {
        interviewDate = parsed.toISOString().slice(0, 10);
      } else {
        // Try dd/mm/yyyy explicitly (common in India)
        const ddmmMatch = interviewDateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (ddmmMatch) {
          const [, d, m, y] = ddmmMatch;
          const year = y.length === 2 ? `20${y}` : y;
          // Assume dd/mm/yyyy if day > 12 (unambiguous)
          if (parseInt(d) > 12) {
            interviewDate = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
          } else {
            // Otherwise try MM/DD/YYYY (US format) first, then dd/mm/yyyy
            const usFormat = new Date(`${m}/${d}/${year}`);
            if (!Number.isNaN(usFormat.getTime())) {
              interviewDate = usFormat.toISOString().slice(0, 10);
            } else {
              // Fall back to dd/mm/yyyy
              interviewDate = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            }
          }
        }
      }
    }
  }

  const interviewTimeRaw = firstMatch(text, [
    /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i,
    /\b(\d{1,2}\s*(?:am|pm))\b/i,
  ]);

  const timezone = firstMatch(text, [
    /\b(IST|GMT|UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|CET|CEST|SGT|JST|AEST)\b/,
    /\b(UTC[+-]\d{1,2}(?::\d{2})?)\b/i,
  ]);

  const salaryRaw = firstMatch(text, [
    /((?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s?[\d,]+(?:\.\d+)?\s?(?:-|to|–)?\s?(?:₹|rs\.?|\$|€|£)?[\d,]*\s?(?:lpa|per annum|per year|k|lakh|cr)?)/i,
    /([\d.]+\s?(?:lpa|lakhs?\s+per\s+annum))/i,
  ]);

  // URLs — classify each and assign to the right slot.
  let interviewLink: string | null = null;
  let assessmentLink: string | null = null;
  let jobUrl: string | null = null;
  let careerPortalUrl: string | null = null;
  const urls = text.match(URL_RE) ?? [];
  for (const url of urls) {
    const clean = url.replace(/[.,;]+$/, "");
    switch (classifyUrl(clean)) {
      case "interview":
        interviewLink ??= clean;
        break;
      case "assessment":
        assessmentLink ??= clean;
        break;
      case "job":
        jobUrl ??= clean;
        break;
      case "career":
        careerPortalUrl ??= clean;
        break;
    }
  }

  // Deadline — capture the phrase after common deadline cues.
  const deadline = firstMatch(text, [
    /(?:complete|submit|respond|confirm|apply|register)\s+(?:by|before|no later than)\s+([^.\n,]{3,40})/i,
    /(?:due|deadline)\s*(?:date)?\s*[:-]?\s*([^.\n,]{3,40})/i,
    /(?:valid|expires?)\s+(?:until|till|by)\s+([^.\n,]{3,40})/i,
  ]);

  // Recruiter identity from the sender header.
  const senderNameMatch = from.match(/^"?([^"<]+?)"?\s*</);
  const recruiterEmail = from.match(/<([^>]+)>/)?.[1] ?? (from.includes("@") ? from.trim() : null);
  const recruiterName = senderNameMatch ? senderNameMatch[1].trim() : null;

  return {
    platform: detectPlatform(from, body),
    applicationId,
    requisitionId,
    candidateId,
    interviewDate,
    interviewTimeRaw,
    timezone,
    interviewLink,
    assessmentLink,
    codingPlatform: detectCodingPlatform(text),
    deadline,
    workMode: detectWorkMode(text),
    location: firstMatch(text, [
      /\blocation\s*[:-]\s*([A-Za-z .,'-]{3,40})/i,
      /\bbased in\s+([A-Za-z .,'-]{3,40})/i,
    ]),
    salaryRaw,
    recruiterName,
    recruiterEmail,
    jobUrl,
    careerPortalUrl,
  };
}
