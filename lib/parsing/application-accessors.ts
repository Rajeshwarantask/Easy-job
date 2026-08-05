import type { ParsedApplication } from "@/lib/parsing/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getApplicationId(app: ParsedApplication): string {
  const a = app as unknown as Record<string, unknown>;
  if (typeof a["applicationId"] === "string" && (a["applicationId"] as string).length > 0) return a["applicationId"] as string;
  if (isObject(a["originalEmail"])) {
    const oe = a["originalEmail"] as Record<string, unknown>;
    if (typeof oe["gmailMessageId"] === "string") return oe["gmailMessageId"] as string;
  }
  if (typeof a["extractedAt"] === "string") return a["extractedAt"] as string;
  if (a["extractedAt"] instanceof Date) return (a["extractedAt"] as Date).toISOString();
  // Last resort: stable JSON-derived id
  try {
    return JSON.stringify(a).slice(0, 64);
  } catch {
    return "";
  }
}

export function getStatus(app: ParsedApplication): string | undefined {
  const a = app as unknown as Record<string, unknown>;
  const s = a["status"] ?? a["application_status"];
  return typeof s === "string" ? s : undefined;
}

export function getStarred(app: ParsedApplication): boolean {
  const a = app as unknown as Record<string, unknown>;
  const s = a["starred"];
  return typeof s === "boolean" ? s : false;
}

export function getParserConfidence(app: ParsedApplication): number | undefined {
  const a = app as unknown as Record<string, unknown>;
  const v = a["parserConfidence"] ?? a["parser_confidence"] ?? a["parserConfidenceScore"] ?? a["parserConfidence"];
  return typeof v === "number" ? v : undefined;
}

export function getParsingPlatform(app: ParsedApplication): string | undefined {
  const a = app as unknown as Record<string, unknown>;
  return typeof a["parsedBy"] === "string" ? (a["parsedBy"] as string) : (typeof a["parsing_platform"] === "string" ? (a["parsing_platform"] as string) : undefined);
}

export function getJobUrl(app: ParsedApplication): string | undefined {
  const a = app as unknown as Record<string, unknown>;
  return typeof a["jobUrl"] === "string" ? (a["jobUrl"] as string) : (typeof a["job_url"] === "string" ? (a["job_url"] as string) : undefined);
}
