/**
 * Date/Time Extraction Module
 * 
 * Handles extraction of dates and times from recruitment emails.
 * Supports multiple formats and languages.
 */

export interface DateTimeExtraction {
  date?: Date;
  time?: string; // HH:MM or HH:MM AM/PM format
  timezone?: string; // e.g., "EST", "PST", "UTC"
  dateString?: string; // Original date text for reference
  timeString?: string; // Original time text
  confidence: number; // 0-1
}

// Month names for date parsing
const MONTH_NAMES = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

// Timezone patterns
const TIMEZONE_PATTERN = /\b(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|UTC|GMT|IST|CET|CEST)\b/i;

/**
 * Extract date from email body.
 * Handles formats like:
 * - "January 15, 2024"
 * - "15/01/2024"
 * - "2024-01-15"
 * - "Jan 15"
 * - "15 January"
 * - "Next Monday"
 * - "In 3 days"
 */
export function extractDateTime(bodyText: string, context?: { sentDate?: Date }): DateTimeExtraction {
  const text = bodyText || "";
  let confidence = 0;
  let date: Date | undefined;
  let time: string | undefined;
  let timezone: string | undefined;
  let dateString: string | undefined;
  let timeString: string | undefined;

  // Extract timezone first (appears often with times)
  const tzMatch = text.match(TIMEZONE_PATTERN);
  if (tzMatch) {
    timezone = tzMatch[0].toUpperCase();
  }

  // Pattern 1: Full date format "Month DD, YYYY" or "Month DD"
  const fullDatePattern = /(?:on|scheduled\s+for|interview\s+on|meeting\s+on)\s+([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;
  let match = text.match(fullDatePattern);

  if (match) {
    const [fullMatch, monthStr, dayStr, yearStr] = match;
    date = parseMonthDayYear(monthStr, dayStr, yearStr);
    if (date) {
      dateString = fullMatch.trim();
      confidence = yearStr ? 0.85 : 0.7;
    }
  }

  // Pattern 2: Numeric format "DD/MM/YYYY" or "MM/DD/YYYY" or "YYYY-MM-DD"
  if (!date) {
    // Try ISO format first (most reliable)
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]) - 1;
      const day = parseInt(isoMatch[3]);
      date = new Date(year, month, day);
      dateString = isoMatch[0];
      confidence = 0.95;
    }

    // Try DD/MM/YYYY or MM/DD/YYYY
    if (!date) {
      const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashMatch) {
        const first = parseInt(slashMatch[1]);
        const second = parseInt(slashMatch[2]);
        const year = parseInt(slashMatch[3]);

        // Guess format based on values (if first > 12, must be DD/MM)
        if (first > 12) {
          date = new Date(year, second - 1, first);
        } else {
          // Ambiguous, try MM/DD first (US format)
          date = new Date(year, first - 1, second);
        }

        dateString = slashMatch[0];
        confidence = 0.8;
      }
    }
  }

  // Pattern 3: Relative dates "in 2 days", "next Friday", etc.
  if (!date && context?.sentDate) {
    const relativeMatch = text.match(/(?:in|within)\s+(\d+)\s+(?:day|week|month)s?/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[0].match(/(?:day|week|month)/i)?.[0].toLowerCase();
      const baseDate = new Date(context.sentDate);

      if (unit === "day") {
        baseDate.setDate(baseDate.getDate() + amount);
      } else if (unit === "week") {
        baseDate.setDate(baseDate.getDate() + amount * 7);
      } else if (unit === "month") {
        baseDate.setMonth(baseDate.getMonth() + amount);
      }

      date = baseDate;
      dateString = relativeMatch[0];
      confidence = 0.6;
    }
  }

  // Extract time separately
  const timeExtraction = extractTime(text);
  if (timeExtraction.time) {
    time = timeExtraction.time;
    timeString = timeExtraction.timeString;
    confidence = Math.max(confidence, timeExtraction.confidence);
  }

  // Validate extracted date
  if (date && !isValidDate(date)) {
    date = undefined;
    confidence = 0;
  }

  return {
    date,
    time,
    timezone,
    dateString,
    timeString,
    confidence,
  };
}

/**
 * Extract time from email body.
 * Handles formats like:
 * - "10:00 AM"
 * - "14:30"
 * - "2:30 PM EST"
 * - "10am"
 */
function extractTime(bodyText: string): { time?: string; timeString?: string; confidence: number } {
  const text = bodyText || "";
  let confidence = 0;
  let time: string | undefined;
  let timeString: string | undefined;

  // Pattern 1: "HH:MM AM/PM" or "HH:MM"
  const timePattern = /(\d{1,2}):(\d{2})\s*(?:(AM|PM|am|pm))?/i;
  const match = text.match(timePattern);

  if (match) {
    const hour = match[1].padStart(2, "0");
    const minute = match[2];
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    time = `${hour}:${minute}`;
    if (meridiem) {
      time += ` ${meridiem}`;
    }

    timeString = match[0];
    confidence = meridiem ? 0.9 : 0.7;
  }

  // Pattern 2: "Xam" or "Xpm" (no colon)
  if (!time) {
    const compactPattern = /(\d{1,2})\s*(am|pm)/i;
    const compactMatch = text.match(compactPattern);

    if (compactMatch) {
      const hour = compactMatch[1].padStart(2, "0");
      const meridiem = compactMatch[2].toUpperCase();
      time = `${hour}:00 ${meridiem}`;
      timeString = compactMatch[0];
      confidence = 0.8;
    }
  }

  return { time, timeString, confidence };
}

/**
 * Parse a date from month, day, and optional year.
 */
function parseMonthDayYear(
  monthStr: string,
  dayStr: string,
  yearStr?: string
): Date | undefined {
  const monthLower = monthStr.toLowerCase();
  const monthNum = MONTH_NAMES[monthLower as keyof typeof MONTH_NAMES];

  if (monthNum === undefined) {
    return undefined;
  }

  const day = parseInt(dayStr);
  if (day < 1 || day > 31) {
    return undefined;
  }

  let year = new Date().getFullYear();
  if (yearStr) {
    const y = parseInt(yearStr);
    if (y > 1900 && y < 2100) {
      year = y;
    }
  }

  return new Date(year, monthNum, day);
}

/**
 * Check if a date is valid and in reasonable range.
 */
function isValidDate(date: Date): boolean {
  if (!(date instanceof Date)) {
    return false;
  }

  // Must be a valid timestamp
  if (isNaN(date.getTime())) {
    return false;
  }

  // Must be within 10 years of today (past or future)
  const now = new Date();
  const diff = Math.abs(date.getTime() - now.getTime());
  const tenYears = 10 * 365.25 * 24 * 60 * 60 * 1000;

  return diff <= tenYears;
}

/**
 * Extract a deadline date from email body.
 * Looks for phrases like "Deadline: ...", "Apply by: ...", "Must respond by: ..."
 */
export function extractDeadline(bodyText: string): DateTimeExtraction {
  const text = bodyText || "";

  // Look for deadline-specific patterns
  const deadlinePattern = /(?:deadline|apply by|respond by|reply by|due by|must submit by)[\s:]*([^,\n]*)/i;
  const match = text.match(deadlinePattern);

  if (match) {
    const deadlineText = match[1];
    return extractDateTime(deadlineText);
  }

  return { confidence: 0 };
}

/**
 * Format an extracted date/time for display.
 */
export function formatDateTime(extraction: DateTimeExtraction): string {
  const parts: string[] = [];

  if (extraction.date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    parts.push(formatter.format(extraction.date));
  }

  if (extraction.time) {
    parts.push(extraction.time);
  }

  if (extraction.timezone) {
    parts.push(extraction.timezone);
  }

  return parts.join(" ");
}
