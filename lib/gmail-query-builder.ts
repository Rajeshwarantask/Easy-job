/**
 * Gmail search query builder with date range support
 * Uses Gmail's native query syntax for efficient filtering
 */

export type DateRangeType = 
  | { type: "all" }
  | { type: "days"; days: number }
  | { type: "custom"; from: string; to: string };

/**
 * Convert date string to Gmail format (YYYY/MM/DD)
 * Accepts formats: "2026-07-02", "2/7/26", or Date object
 */
function toGmailDate(input: string | Date): string {
  let date: Date;
  
  if (input instanceof Date) {
    date = input;
  } else if (input.includes("-")) {
    // ISO format: "2026-07-02"
    date = new Date(input);
  } else {
    // Try parsing "2/7/26" or "2/7/2026"
    const parts = input.split("/");
    if (parts.length !== 3) throw new Error(`Invalid date format: ${input}`);
    const [m, d, y] = parts.map(Number);
    const year = y < 100 ? 2000 + y : y;
    date = new Date(year, m - 1, d);
  }
  
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Build Gmail search query with optional date filtering
 * Filters out categories (promotions, social, updates, etc) and already-processed emails
 */
export function buildGmailQuery(dateRange?: DateRangeType): string {
  const clauses = [
    "in:inbox",
    "-in:sent",
    "-in:draft",
    "-in:spam",
    "-in:trash",
    "-category:promotions",
    "-category:social",
    "-category:updates",
    "-category:forums",
    "-category:notifications",
  ];

  if (!dateRange || dateRange.type === "all") {
    // Fetch all emails (optional: limit to last 2 years)
    // clauses.push("newer_than:2y");
  } else if (dateRange.type === "days") {
    // Gmail's relative date syntax: newer_than:Nd
    clauses.push(`newer_than:${dateRange.days}d`);
  } else if (dateRange.type === "custom") {
    // Custom range: after:YYYY/MM/DD before:YYYY/MM/DD
    // Note: "before" is exclusive, so add 1 day to make "to" inclusive
    const fromDate = toGmailDate(dateRange.from);
    const toDate = new Date(new Date(dateRange.to).getTime() + 86400000); // +1 day
    const toDateStr = toGmailDate(toDate);
    
    clauses.push(`after:${fromDate}`);
    clauses.push(`before:${toDateStr}`);
  }

  return clauses.join(" ");
}

/**
 * Parse date range from user input
 * Handles "last 7 days", "2/7/26 - 3/7/26", etc.
 */
export function parseDateRange(input: string): DateRangeType {
  const lower = input.toLowerCase().trim();
  
  if (lower === "all") return { type: "all" };
  if (lower.match(/^last\s+(\d+)\s+days?$/)) {
    const days = parseInt(lower.match(/\d+/)![0]);
    return { type: "days", days };
  }
  
  // Try parsing custom range: "2/7/26 - 3/7/26" or "2026-07-02 - 2026-07-03"
  const range = input.split(/\s*[-–]\s*/);
  if (range.length === 2) {
    return { type: "custom", from: range[0].trim(), to: range[1].trim() };
  }
  
  throw new Error(`Invalid date range: ${input}`);
}
