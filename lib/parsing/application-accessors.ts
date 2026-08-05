import type { ParsedApplication } from "@/lib/parsing/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// small helper to avoid repeating casts - returns a record view of the parser object
function toRecord(app: ParsedApplication): Record<string, unknown> {
  return app as unknown as Record<string, unknown>;
}

function getField<T = unknown>(app: ParsedApplication, ...keys: string[]): T | undefined {
  const r = toRecord(app);
  for (const k of keys) {
    if (k in r) {
      const v = r[k];
      return v as T;
    }
  }
  return undefined;
}

export function getApplicationId(app: ParsedApplication): string {
  const id = getField<string>(app, "applicationId");
  if (typeof id === "string" && id.length > 0) return id;

  const oe = getField<Record<string, unknown>>(app, "originalEmail");
  if (isObject(oe) && typeof oe["gmailMessageId"] === "string") return oe["gmailMessageId"] as string;

  const extractedAt = getField<string | Date>(app, "extractedAt");
  if (typeof extractedAt === "string") return extractedAt;
  if (extractedAt instanceof Date) return extractedAt.toISOString();

  try {
    return JSON.stringify(toRecord(app)).slice(0, 64);
  } catch {
    return "";
  }
}

export function getStatus(app: ParsedApplication): string | undefined {
  return getField<string>(app, "status", "application_status");
}

export function getStarred(app: ParsedApplication): boolean {
  const v = getField<unknown>(app, "starred");
  return typeof v === "boolean" ? v : false;
}

export function getParserConfidence(app: ParsedApplication): number | undefined {
  return getField<number>(app, "parserConfidence", "parser_confidence", "parserConfidenceScore");
}

export function getParsingPlatform(app: ParsedApplication): string | undefined {
  return getField<string>(app, "parsedBy", "parsing_platform");
}

export function getJobUrl(app: ParsedApplication): string | undefined {
  return getField<string>(app, "jobUrl", "job_url");
}

// Typed UI accessors
export function getCompany(app: ParsedApplication): string | undefined {
  return getField<string>(app, "company");
}

export function getRole(app: ParsedApplication): string | undefined {
  return getField<string>(app, "role");
}

export function getLocation(app: ParsedApplication): string | undefined {
  return getField<string>(app, "location");
}

export function getWorkMode(app: ParsedApplication): string | undefined {
  return getField<string>(app, "workMode", "work_mode");
}
